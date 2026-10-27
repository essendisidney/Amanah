import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { APP_NAME } from '@jamiya/shared';

// The picture WhatsApp, X, LinkedIn and others show when someone shares a Jameiyah link.
export const alt = `${APP_NAME}: save together, without interest`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage() {
  // Built once at build time, from the web app's folder.
  const mark = await readFile(join(process.cwd(), 'public/brand/jameiyah-mark.png'));
  const markSrc = `data:image/png;base64,${mark.toString('base64')}`;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 80px',
        background: 'linear-gradient(135deg, #03201b 0%, #004038 100%)',
        color: '#f5f3ee',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div
          style={{
            display: 'flex',
            width: 96,
            height: 96,
            borderRadius: 24,
            background: '#f5f3ee',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img src={markSrc} width={72} height={72} alt="" />
        </div>
        <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>{APP_NAME}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
          Save together. See every shilling.
        </div>
        <div style={{ fontSize: 34, color: '#D8A038', fontWeight: 600 }}>
          Circles, merry-go-rounds and savings, without interest.
        </div>
      </div>
      <div style={{ fontSize: 26, color: 'rgba(245,243,238,0.7)' }}>jameiyah.com</div>
    </div>,
    size,
  );
}
