export type TvProvisioningStatus = 'PENDING' | 'PAIRED' | 'CLAIMED' | 'REVOKED';

export interface TvRoomReference {
  id: string;
  number: string;
}

export interface TvDeviceRecord {
  id: string;
  installationId: string;
  deviceCode: string;
  pairingCodeHash: string;
  pairingExpiresAt: string;
  credentialHash: string;
  credential: string | null;
  status: TvProvisioningStatus;
  room: TvRoomReference | null;
  deviceModel: string;
  appVersion: string;
  androidApiLevel: number;
  createdAt: string;
  pairedAt: string | null;
  claimedAt: string | null;
  revokedAt: string | null;
}

export interface StartTvProvisioningInput {
  installationId: string;
  appVersion: string;
  deviceModel: string;
  androidApiLevel: number;
}

export interface StartTvProvisioningResult {
  deviceId: string;
  deviceCode: string;
  pairingCode: string;
  expiresAt: string;
}

export interface CreatedTvDevice {
  record: TvDeviceRecord;
  pairingCode: string;
}

export interface PairTvDeviceInput {
  pairingCode: string;
  roomId: string;
  roomNumber: string;
}

export interface ClaimTvProvisioningInput {
  pairingCode: string;
  installationId: string;
}

export interface TvDevicePublic {
  id: string;
  deviceCode: string;
  room: TvRoomReference;
}

export interface TvContext {
  device: TvDevicePublic;
  roomStatus: 'VACANT' | 'OCCUPIED';
  welcome: {
    message: string;
    guestName: string | null;
    personalized: boolean;
  };
}

export interface PairTvDeviceResult {
  device: TvDevicePublic;
  pairedAt: string;
}

export interface ClaimTvProvisioningResult {
  credential: string;
  device: TvDevicePublic;
}

export interface ResetTvDeviceResult {
  deviceId: string;
  status: 'PENDING';
  pairingExpiresAt: string;
}
