import type { AppLoadContext } from '@remix-run/node';
import { RemixServer } from '@remix-run/react';
import { isbot } from 'isbot';
import { renderToReadableStream } from 'react-dom/server.browser';
import { renderHeadToString } from 'remix-island';
import { Head } from './root';
import { themeStore } from '~/lib/stores/theme';

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: any,
  _loadContext: AppLoadContext,
) {
  // await initializeModelList({});

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 55000); // 55s timeout for Vercel

  try {
    const readable = await renderToReadableStream(<RemixServer context={remixContext} url={request.url} />, {
      signal: abortController.signal,
      onError(error: unknown) {
        console.error(error);
        responseStatusCode = 500;
      },
    });

  const body = new ReadableStream({
    start(controller) {
      const head = renderHeadToString({ request, remixContext, Head });
      let isClosed = false;

      controller.enqueue(
        new Uint8Array(
          new TextEncoder().encode(
            `<!DOCTYPE html><html lang="en" data-theme="${themeStore.value}"><head>${head}</head><body><div id="root" class="w-full h-full">`,
          ),
        ),
      );

      const reader = readable.getReader();

      function read() {
        reader
          .read()
          .then(({ done, value }) => {
            if (isClosed) return;
            
            if (done) {
              try {
                controller.enqueue(new Uint8Array(new TextEncoder().encode('</div></body></html>')));
                controller.close();
                isClosed = true;
              } catch (e) {
                // Controller already closed
              }
              return;
            }

            controller.enqueue(value);
            read();
          })
          .catch((error) => {
            if (!isClosed) {
              try {
                controller.error(error);
                isClosed = true;
              } catch (e) {
                // Controller already closed
              }
            }
            readable.cancel();
          });
      }
      read();
    },

    cancel() {
      readable.cancel();
    },
  });

  if (isbot(request.headers.get('user-agent') || '')) {
    await readable.allReady;
  }

    responseHeaders.set('Content-Type', 'text/html');

    // CSP disabled to allow Spline 3D viewer
    // responseHeaders.set(
    //   'Content-Security-Policy',
    //   "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://*.clerk.accounts.dev https://clerk.elaric.ai blob:; frame-src 'self' https://accounts.google.com https://*.clerk.accounts.dev https://clerk.elaric.ai; connect-src 'self' https://accounts.google.com https://*.clerk.accounts.dev https://clerk.elaric.ai https://*.supabase.co https://*.spline.design https://*.splinecode.com;"
    // );

    // COEP/COOP disabled - conflicts with Spline
    // if (process.env.NODE_ENV === 'development') {
    //   responseHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
    //   responseHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
    // }

    return new Response(body, {
      headers: responseHeaders,
      status: responseStatusCode,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
