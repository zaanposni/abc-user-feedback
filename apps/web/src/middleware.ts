/**
 * Copyright 2023 LINE Corporation
 *
 * LINE Corporation licenses this file to you under the Apache License,
 * version 2.0 (the "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at:
 *
 *   https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 */
import { getIronSession } from 'iron-session/edge';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { DEFAULT_LOCALE } from './constants/i18n';
import { ironOption } from './constants/iron-option';
import { Path } from './constants/path';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  if (Path.isErrorPage(req.nextUrl.pathname)) return res;

  const session = await getIronSession(req, res, ironOption);

  const isProtected = Path.isProtectPage(req.nextUrl.pathname);

  if (session.jwt && !isProtected) {
    return NextResponse.redirect(new URL(Path.MAIN, req.url));
  }

  if (!session.jwt && isProtected) {
    return NextResponse.redirect(new URL(Path.SIGN_IN, req.url));
  }

  if (req.nextUrl.locale === 'default') {
    const locale = req.cookies.get('NEXT_LOCALE')?.value || DEFAULT_LOCALE;
    return NextResponse.redirect(
      new URL(
        `/${locale}${req.nextUrl.pathname}${req.nextUrl.search}`,
        req.url,
      ),
    );
  }

  return res;
}

export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico|fonts|assets).*)',
};
