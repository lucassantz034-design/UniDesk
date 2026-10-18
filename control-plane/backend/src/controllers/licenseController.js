const db = require('../db');
const { issueLicenseToken } = require('../services/cryptoService');

const licenseController = {
  /**
   * POST /api/v1/license/activate
   * Vincula uma chave de licença a uma instância física (instance_uuid)
   * Body: { license_key, instance_uuid, system_info }
   */
  async activate(req, res) {
    try {
      const { license_key, instance_uuid, system_info } = req.body;

      if (!license_key || !instance_uuid) {
        return res.status(400).json({
          success: false,
          error: 'license_key e instance_uuid são obrigatórios.'
        });
      }

      const license = await db.getLicenseByKey(license_key);
      if (!license) {
        return res.status(404).json({
          success: false,
          error: 'Chave de licença não encontrada ou inválida.'
        });
      }

      // Se já está vinculada a outra instância diferente
      if (license.instance_uuid && license.instance_uuid !== instance_uuid) {
        return res.status(409).json({
          success: false,
          error: 'Esta chave de licença já está vinculada a outra instância do UniDesk.',
          existing_instance: license.instance_uuid
        });
      }

      // Verifica status de bloqueio
      if (license.status === 'REVOKED' || license.status === 'SUSPENDED') {
        return res.status(403).json({
          success: false,
          error: `Licença bloqueada com status: ${license.status}. Contate o suporte comercial.`
        });
      }

      const now = new Date();
      const updatedLicense = await db.updateLicense(license_key, {
        instance_uuid: instance_uuid,
        activated_at: license.activated_at || now.toISOString(),
        last_heartbeat_at: now.toISOString()
      });

      // Emite Token Ed25519
      const tokenPayload = {
        tenant_id: updatedLicense.tenant_id,
        license_key: updatedLicense.license_key,
        instance_uuid: updatedLicense.instance_uuid,
        plan_tier: updatedLicense.plan_tier,
        max_devices: updatedLicense.max_devices,
        status: updatedLicense.status,
        valid_until: updatedLicense.valid_until,
        grace_until: updatedLicense.grace_until
      };

      const signedToken = issueLicenseToken(tokenPayload);

      return res.status(200).json({
        success: true,
        message: 'Licença ativada e vinculada com sucesso.',
        token: signedToken,
        license: {
          status: updatedLicense.status,
          plan_tier: updatedLicense.plan_tier,
          max_devices: updatedLicense.max_devices,
          valid_until: updatedLicense.valid_until,
          grace_until: updatedLicense.grace_until
        }
      });
    } catch (error) {
      console.error('[License Controller] Erro ao ativar:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno ao processar ativação de licença.'
      });
    }
  },

  /**
   * POST /api/v1/license/heartbeat
   * Valida status da licença periodicamente pela instância local
   * Body: { instance_uuid, license_key }
   */
  async heartbeat(req, res) {
    try {
      const { instance_uuid, license_key } = req.body;

      if (!instance_uuid) {
        return res.status(400).json({
          success: false,
          error: 'instance_uuid é obrigatório.'
        });
      }

      let license = null;
      if (license_key) {
        license = await db.getLicenseByKey(license_key);
      } else {
        license = await db.getLicenseByInstance(instance_uuid);
      }

      if (!license) {
        return res.status(404).json({
          success: false,
          error: 'Licença não encontrada para esta instância.'
        });
      }

      if (license.instance_uuid !== instance_uuid) {
        return res.status(403).json({
          success: false,
          error: 'instance_uuid divergente da licença vinculada.'
        });
      }

      const now = new Date();
      const validUntilDate = new Date(license.valid_until);
      const graceUntilDate = license.grace_until ? new Date(license.grace_until) : null;

      let currentStatus = license.status;

      // Validação de expiração dinâmica
      if (currentStatus === 'ACTIVE' && now > validUntilDate) {
        // Entra em grace period de 15 dias se já não estiver definido
        const autoGrace = new Date(validUntilDate.getTime() + 15 * 24 * 60 * 60 * 1000);
        if (now <= autoGrace) {
          currentStatus = 'GRACE_PERIOD';
          await db.updateLicense(license.license_key, {
            status: 'GRACE_PERIOD',
            grace_until: autoGrace.toISOString()
          });
        } else {
          currentStatus = 'SUSPENDED';
          await db.updateLicense(license.license_key, { status: 'SUSPENDED' });
        }
      } else if (currentStatus === 'GRACE_PERIOD' && graceUntilDate && now > graceUntilDate) {
        currentStatus = 'SUSPENDED';
        await db.updateLicense(license.license_key, { status: 'SUSPENDED' });
      }

      const updated = await db.updateLicense(license.license_key, {
        last_heartbeat_at: now.toISOString()
      });

      const tokenPayload = {
        tenant_id: updated.tenant_id,
        license_key: updated.license_key,
        instance_uuid: updated.instance_uuid,
        plan_tier: updated.plan_tier,
        max_devices: updated.max_devices,
        status: currentStatus,
        valid_until: updated.valid_until,
        grace_until: updated.grace_until
      };

      const signedToken = issueLicenseToken(tokenPayload);

      return res.status(200).json({
        success: true,
        status: currentStatus,
        token: signedToken,
        license: {
          status: currentStatus,
          valid_until: updated.valid_until,
          grace_until: updated.grace_until,
          max_devices: updated.max_devices
        }
      });
    } catch (error) {
      console.error('[License Controller] Erro no heartbeat:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno ao validar heartbeat.'
      });
    }
  }
};

module.exports = licenseController;
