import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import { InMemoryMediaRepository } from './media.repository';
import { MediaService } from './media.service';

describe('MediaService', () => {
  it('stores supported product media and returns a stable public URL', async () => {
    const service = new MediaService(
      new ConfigService({ AUTH_STORE: 'memory' }),
      new InMemoryMediaRepository(),
    );
    const buffer = Buffer.from([137, 80, 78, 71]);
    const uploaded = await service.upload({
      buffer,
      mimetype: 'image/png',
      originalname: '../product image.png',
      size: buffer.byteLength,
    });

    expect(uploaded).toMatchObject({
      contentType: 'image/png',
      fileName: '..-product-image.png',
      byteSize: buffer.byteLength,
      url: `/api/v1/media/${uploaded.id}`,
    });
    await expect(service.read(uploaded.id)).resolves.toEqual({
      body: buffer,
      contentType: 'image/png',
    });
  });
});
