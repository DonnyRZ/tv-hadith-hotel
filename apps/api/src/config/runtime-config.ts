const PRODUCTION = 'production';
const POSTGRES = 'postgres';
export const TV_UPDATE_PACKAGE_NAME = 'com.roomservice.tv';
export const TV_PRODUCTION_CERTIFICATE_SHA256 =
  '50dff6906e42e0ea5ee933225fadf4a55cb9a2050baaeafa3bff8b6d90820904';

function readString(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  return typeof value === 'string' ? value.trim() : '';
}

function readBoolean(value: string): boolean {
  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
}

function isBooleanValue(value: string): boolean {
  return (
    value === '0' ||
    value === '1' ||
    value.toLowerCase() === 'true' ||
    value.toLowerCase() === 'false' ||
    value.toLowerCase() === 'yes' ||
    value.toLowerCase() === 'no'
  );
}

function isSha256(value: string): boolean {
  return /^[0-9a-f]{64}$/iu.test(value);
}

function isHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === 'https:' &&
      parsed.username.length === 0 &&
      parsed.password.length === 0 &&
      parsed.search.length === 0 &&
      parsed.hash.length === 0 &&
      parsed.hostname.length > 0
    );
  } catch {
    return false;
  }
}

/**
 * Validates deployment-critical settings before Nest creates any repository.
 * Development and test environments intentionally keep their in-memory
 * adapters, while production must fail closed instead of losing pairing data
 * after a restart or routing requests to a process-local store.
 */
export function validateRuntimeConfig(config: Record<string, unknown>) {
  const nodeEnvironment = readString(config, 'NODE_ENV') || 'development';
  const environment = readString(config, 'APP_ENVIRONMENT') || nodeEnvironment;

  if (nodeEnvironment !== PRODUCTION) return config;

  const errors: string[] = [];
  if (environment !== PRODUCTION) {
    errors.push("APP_ENVIRONMENT must be 'production'");
  }
  if (readString(config, 'AUTH_STORE') !== POSTGRES) {
    errors.push("AUTH_STORE must be 'postgres'");
  }
  if (readString(config, 'SESSION_STORE') !== POSTGRES) {
    errors.push("SESSION_STORE must be 'postgres'");
  }
  if (readString(config, 'DATABASE_URL').length === 0) {
    errors.push('DATABASE_URL is required');
  }
  if (readString(config, 'SESSION_SECRET').length < 32) {
    errors.push('SESSION_SECRET must contain at least 32 characters');
  }
  if (readString(config, 'RELEASE_ID').length === 0) {
    errors.push('RELEASE_ID is required');
  }
  const configuredRealtime = readString(config, 'STAFF_REALTIME_ENABLED');
  const realtimeEnabled = configuredRealtime.length === 0 || readBoolean(configuredRealtime);
  if (realtimeEnabled && readString(config, 'REDIS_URL').length === 0) {
    errors.push('REDIS_URL is required when STAFF_REALTIME_ENABLED is true');
  }

  const configuredPairingTtl = readString(config, 'TV_PAIRING_TTL_SECONDS');
  if (configuredPairingTtl.length > 0) {
    const pairingTtl = Number(configuredPairingTtl);
    if (!Number.isInteger(pairingTtl) || pairingTtl < 60 || pairingTtl > 3600) {
      errors.push('TV_PAIRING_TTL_SECONDS must be an integer between 60 and 3600');
    }
  }

  const configuredTvUpdate = readString(config, 'TV_UPDATE_ENABLED');
  if (configuredTvUpdate.length > 0 && !isBooleanValue(configuredTvUpdate)) {
    errors.push('TV_UPDATE_ENABLED must be a boolean');
  }
  if (readBoolean(configuredTvUpdate)) {
    const updateVersionCode = Number(readString(config, 'TV_UPDATE_VERSION_CODE'));
    if (!Number.isInteger(updateVersionCode) || updateVersionCode <= 0) {
      errors.push(
        'TV_UPDATE_VERSION_CODE must be a positive integer when TV_UPDATE_ENABLED is true',
      );
    }
    if (readString(config, 'TV_UPDATE_VERSION_NAME').length === 0) {
      errors.push('TV_UPDATE_VERSION_NAME is required when TV_UPDATE_ENABLED is true');
    }
    if (!isHttpsUrl(readString(config, 'TV_UPDATE_APK_URL'))) {
      errors.push('TV_UPDATE_APK_URL must be an absolute HTTPS URL when TV_UPDATE_ENABLED is true');
    }
    if (!isSha256(readString(config, 'TV_UPDATE_SHA256'))) {
      errors.push(
        'TV_UPDATE_SHA256 must be a 64-character SHA-256 value when TV_UPDATE_ENABLED is true',
      );
    }
    const updateCertificate = readString(config, 'TV_UPDATE_CERTIFICATE_SHA256');
    if (!isSha256(updateCertificate)) {
      errors.push(
        'TV_UPDATE_CERTIFICATE_SHA256 must be a 64-character SHA-256 value when TV_UPDATE_ENABLED is true',
      );
    } else if (updateCertificate.toLowerCase() !== TV_PRODUCTION_CERTIFICATE_SHA256) {
      errors.push(
        'TV_UPDATE_CERTIFICATE_SHA256 must match the existing production TV certificate when TV_UPDATE_ENABLED is true',
      );
    }
    const configuredMandatory = readString(config, 'TV_UPDATE_MANDATORY');
    if (configuredMandatory.length > 0 && !isBooleanValue(configuredMandatory)) {
      errors.push('TV_UPDATE_MANDATORY must be a boolean');
    }
    const configuredMinimum = readString(config, 'TV_UPDATE_MIN_SUPPORTED_VERSION_CODE');
    if (configuredMinimum.length > 0) {
      const minimumVersionCode = Number(configuredMinimum);
      if (!Number.isInteger(minimumVersionCode) || minimumVersionCode <= 0) {
        errors.push('TV_UPDATE_MIN_SUPPORTED_VERSION_CODE must be a positive integer');
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid production configuration: ${errors.join('; ')}.`);
  }

  return config;
}

export function runtimeEnvironment(config: {
  get<T = unknown>(propertyPath: string, defaultValue?: T): T | undefined;
}): string {
  const configured = config.get<string>('APP_ENVIRONMENT')?.trim();
  return configured || config.get<string>('NODE_ENV')?.trim() || 'development';
}

export function runtimeReleaseId(config: {
  get<T = unknown>(propertyPath: string, defaultValue?: T): T | undefined;
}): string {
  return config.get<string>('RELEASE_ID')?.trim() || 'local';
}
