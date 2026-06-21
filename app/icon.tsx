// src/app/icon.tsx
import { ImageResponse } from 'next/og'

// アイコンのサイズ（タブレットのホーム画面でも綺麗に見えるサイズ）
export const size = {
  width: 512,
  height: 512,
}
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 340, // 絵文字の大きさ
          background: 'transparent', // 背景を透明に
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        🍳
      </div>
    ),
    {
      ...size,
    }
  )
}