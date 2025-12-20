// components/Pixels.tsx
"use client";

import Script from "next/script";

export default function Pixels() {
  return (
    <>
      {/* --- FACEBOOK PIXEL (META) --- */}
      <Script
        id="fb-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            
            // TU ID YA ESTA PUESTO AQUI:
            fbq('init', '1974918576756082'); 
            fbq('track', 'PageView');
          `,
        }}
      />
      
      {/* SI AUN NO TIENES TIKTOK, PUEDES DEJAR ESTA PARTE COMENTADA O BORRARLA HASTA QUE LO TENGAS */}
    </>
  );
}