import json, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
# One switch for the whole build: STAGING in build.py (True = new.satingraphic.ca test copy, never indexed).
_b = open(os.path.join(HERE, 'build.py'), encoding='utf-8').read()
STAGING = (os.environ.get('SEO_STAGING') or re.search(r"^STAGING\s*=\s*(True|False)", _b, re.M).group(1)) in ('True', '1', 'true')
ORIGIN = (os.environ.get('SEO_ORIGIN') or re.search(r"^ORIGIN\s*=\s*'([^']+)'", _b, re.M).group(1)).rstrip('/')
STAGING_HOST = 'new.satingraphic.ca'
# After launch new.satingraphic.ca may keep serving the same files (shared docroot) or its own copy.
# False: it stays reachable (admin/testing) but sends X-Robots-Tag noindex.  True: GET/HEAD pages 301 to ORIGIN.
STAGING_HOST_REDIRECT = os.environ.get('SEO_STAGING_HOST_REDIRECT', '1') in ('1', 'true', 'True')   # site lives on satingraphic.ca since 2026-10-10
OUT = os.environ.get('HTACCESS_OUT') or '/home/claude/hp/php/docroot/.htaccess'
opt = json.load(open(os.environ.get('HTACCESS_OPT') or '/home/claude/hp/out/satin-new/data/optimized-assets.json'))
OLD = json.load(open(os.path.join(HERE, 'data', 'old-site-redirects.json')))   # old Wix path -> new /satin/ page

def rx(s):   # literal text -> Apache PCRE
    return re.sub(r'([.^$*+?()\[\]{}|\\])', r'\\\1', s)
host_rx = lambda h: '^' + rx(h) + '(:[0-9]+)?$'
PROD_HOST = re.sub(r'^https?://', '', ORIGIN)
# In production old-site redirects go straight to the canonical origin (one hop from http:// or www.).
BASE = '' if STAGING else ORIGIN

L=["Options -Indexes","DirectoryIndex index.html","AddType text/javascript .mjs .js","AddType image/webp .webp","AddType font/woff2 .woff2","AddType image/svg+xml .svg","AddType application/json .json","AddType application/manifest+json .webmanifest","AddType text/plain .txt","AddDefaultCharset utf-8","",
"# compression: Brotli when the server has it, otherwise gzip",
"<IfModule mod_brotli.c>","AddOutputFilterByType BROTLI_COMPRESS text/html text/css text/plain text/xml text/javascript application/javascript application/json application/xml application/ld+json image/svg+xml","</IfModule>",
"<IfModule !mod_brotli.c>","<IfModule mod_deflate.c>","AddOutputFilterByType DEFLATE text/html text/css text/plain text/xml text/javascript application/javascript application/json application/xml application/ld+json image/svg+xml","</IfModule>","</IfModule>","",
"# the staging hostname is never indexed, even when it shares this docroot with the live domain",
"SetEnvIfNoCase Host \"%s\" SATIN_STAGING_HOST" % host_rx(STAGING_HOST),"",
"<IfModule mod_headers.c>","Header always set X-Content-Type-Options nosniff","Header always set Referrer-Policy strict-origin-when-cross-origin"]
if STAGING: L += ["Header always set X-Robots-Tag \"noindex, nofollow\""]   # staging build: nothing is indexable
else: L += ["Header always set X-Robots-Tag \"noindex, nofollow\" env=SATIN_STAGING_HOST"]   # production build: only the staging host
# NOTE: no filename-based "immutable" rule: satin.<hash>.js/css are edited in place, only the ?v= query is a real content hash.
L += ["<FilesMatch \"\\.html$\">","Header set Cache-Control \"no-cache\"","</FilesMatch>",
"<FilesMatch \"\\.(css|mjs|js|json)$\">","Header set Cache-Control \"public, max-age=600\"","</FilesMatch>",
"<FilesMatch \"\\.(png|jpe?g|webp|avif|svg|gif|mp4|ico)$\">","Header set Cache-Control \"public, max-age=604800\"","</FilesMatch>",
"<FilesMatch \"\\.woff2$\">","Header set Cache-Control \"public, max-age=2592000\"","</FilesMatch>",
"<FilesMatch \"^(robots\\.txt|llms(-full)?\\.txt|sitemap\\.xml)$\">","Header set Cache-Control \"public, max-age=3600\"","</FilesMatch>",
"# customer app: service workers and the web app manifest are always revalidated (a deploy is live at once)","<FilesMatch \"^(sw\\.js|manifest\\.webmanifest|manifest\\.json)$\">","Header set Cache-Control \"no-cache\"","</FilesMatch>",
"# app links for the store apps: Android (assetlinks.json) and iOS (apple-app-site-association, no file extension)","<FilesMatch \"^(assetlinks\\.json|apple-app-site-association)$\">","Header set Cache-Control \"public, max-age=3600\"","</FilesMatch>",
"# CSS/JS/JSON referenced with a content hash (?v=…, added by seo_pass.py) never change: cache for a year",
"<If \"%{QUERY_STRING} =~ /(^|&)v=[0-9a-f]{8,}(&|$)/\">","Header set Cache-Control \"public, max-age=31536000, immutable\"","</If>",
"</IfModule>","",
"<IfModule mod_expires.c>","ExpiresActive On","ExpiresByType text/html \"access plus 0 seconds\"","ExpiresByType image/webp \"access plus 7 days\"","ExpiresByType image/jpeg \"access plus 7 days\"","ExpiresByType image/png \"access plus 7 days\"","ExpiresByType image/svg+xml \"access plus 7 days\"","ExpiresByType font/woff2 \"access plus 30 days\"","</IfModule>","",
"RewriteEngine On","",
"# AutoSSL / ACME domain validation must reach its file over plain http, before any redirect",
"RewriteRule ^\\.well-known/(acme-challenge|pki-validation)/ - [L]",
"# store app verification files: served as-is as JSON, never redirected (Google and Apple do not follow redirects)","<Files \"apple-app-site-association\">","ForceType application/json","</Files>","RewriteRule ^\\.well-known/(assetlinks\\.json|apple-app-site-association)$ - [L]",""]

# --- old Wix site (www.satingraphic.ca) -> new pages. Before the canonical rules so http://www.… is one hop.
# Old paths never contain a dot and never start with satin/, so assets and new pages skip the whole block.
old = []
for src, dst in sorted(OLD.items()):
    if src == '/': continue   # handled by the ^$ rule below
    assert dst.startswith('/satin/') and dst.endswith('/'), (src, dst)
    old.append("RewriteRule ^%s/?$ %s%s? [R=301,L,NC]" % (rx(src.strip('/')), BASE, dst))
old += ["RewriteRule ^product-page/ %s/satin/print-shop/? [R=301,L,NC]" % BASE,
        "RewriteRule ^category/ %s/satin/print-shop/? [R=301,L,NC]" % BASE,
        "RewriteRule ^(post|blog)/ %s/satin/guides/? [R=301,L,NC]" % BASE]
L += ["# old Wix URLs (%d mapped in data/old-site-redirects.json + catch-alls); \"?\" drops Wix query strings" % (len(old) - 3),
      "RewriteRule \\.|^satin/ - [S=%d]" % len(old)] + old + [""]

if not STAGING:   # production: one canonical origin (https, no www)
    L += ["# root of the live domain: straight to the canonical /satin/ (one hop from http:// and www.)",
          "RewriteCond %%{HTTP_HOST} ^(www\\.)?%s(:[0-9]+)?$ [NC]" % rx(PROD_HOST),
          "RewriteRule ^$ %s/satin/ [R=301,L]" % ORIGIN, ""]
    if STAGING_HOST_REDIRECT:
        L += ["# staging hostname retired: pages and admin 301 to the live domain (only the API keeps answering, for open sessions)",
              "RewriteCond %%{HTTP_HOST} %s [NC]" % host_rx(STAGING_HOST),
              "RewriteCond %{REQUEST_METHOD} ^(GET|HEAD)$",
              "RewriteRule !^(api/|api\\.php) %s%%{REQUEST_URI} [R=301,L]" % ORIGIN, ""]
    L += ["# canonical origin: https and no www (X-Forwarded-Proto guard for proxies/CDNs)",
          "RewriteCond %{HTTP_HOST} ^www\\.(.+)$ [NC]","RewriteRule ^ https://%1%{REQUEST_URI} [R=301,L]",
          "RewriteCond %{HTTPS} off","RewriteCond %{HTTP:X-Forwarded-Proto} !https","RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]",""]
L += ["# the site lives under /satin/: a real 301 instead of the meta refresh in /index.html","RewriteRule ^$ /satin/ [R=301,L]","",
"# IndexNow key file (key set in Admin → Business info & SEO; answered by api.php)","RewriteRule ^[a-f0-9]{32}\\.txt$ api.php [L]","",
"# API and admin","RewriteRule ^api/ api.php [L,QSA]","RewriteRule ^sitemap\\.xml$ api.php [L]","RewriteRule ^admin$ /admin/ [R=301,L]","","# Our Work project pages: admin-added ones (no static file) and shipped ones with the owner's renames (portfolio.php)","RewriteRule ^satin/(?:(?:fa|fr|es)/)?portfolio/projects/[a-z0-9-]+/?$ api.php [L,QSA]","","# checkout page (the Worker served /checkout/index.html for /satin/checkout and its language variants)","RewriteRule ^satin/(?:(?:fa|fr|es)/)?checkout/?$ checkout/index.html [L]","",
"# Our Work data: the shipped list + Admin → Our Work renames (portfolio.php)","RewriteRule ^cms/portfolio-data\\.mjs$ api.php [L]","","# external images (supplier/Google photos) live on our host: a file not copied yet is fetched once by api.php (ext_images.php)","RewriteCond %{REQUEST_FILENAME} !-f","RewriteRule ^satin/img/ext/[0-9a-f]{16}\\.(?:jpe?g|png|webp|gif|svg|avif)$ api.php [L]","",
"# optimized images (same map as the original Worker)"]
for src,dst in sorted(opt.items()):
    L.append("RewriteRule ^%s$ %s [L]" % (src.lstrip('/').replace('.','\\.').replace('+','\\+'), dst.lstrip('/')))
L+=["","ErrorDocument 404 /notfound.php",""]
open(OUT,'w').write("\n".join(L))
print(len(opt), 'assets,', len(old), 'old-site rules,', 'staging' if STAGING else 'PRODUCTION (indexable) ' + ORIGIN, '->', OUT)
