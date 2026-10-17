set -e
H=/home/claude/hp; P=$H/pkg; rm -rf $P; mkdir -p $P
rm -rf $H/php/docroot/studio && cp -r /home/claude/gh-satin/dist/client/studio $H/php/docroot/studio  # studio source of truth: gh-satin
cp -r $H/out/new.satingraphic.ca $P/new.satingraphic.ca
cp $H/php/docroot/.user.ini $H/php/docroot/api.php $H/php/docroot/notfound.php $H/php/docroot/admin.html $H/php/docroot/.htaccess $P/new.satingraphic.ca/
cp -r $H/php/docroot/admin/. $P/new.satingraphic.ca/admin/; cp -r $H/php/docroot/cms/. $P/new.satingraphic.ca/cms/; cp -r $H/php/docroot/studio/. $P/new.satingraphic.ca/studio/; mkdir -p $P/new.satingraphic.ca/invoice; cp $H/php/docroot/invoice/index.html $P/new.satingraphic.ca/invoice/
cp -r $H/php/docroot/.well-known $P/new.satingraphic.ca/ 2>/dev/null || true; cp $H/php/docroot/google3005dfdca5cd9a9c.html $P/new.satingraphic.ca/ 2>/dev/null || true
mkdir -p $P/satin-new; cp -r $H/php/satin-new/. $P/satin-new/; cp -r $H/out/satin-new/data $P/satin-new/data
find $P -size +9M -type f
du -sh $P; find $P -type f | wc -l
