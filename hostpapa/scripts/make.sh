set -e
cd /home/claude/hp
python3 build.py
node --no-warnings export-data.mjs
python3 seo_pass.py /home/claude/hp/out
python3 seo_i18n.py /home/claude/hp/out
python3 gen-htaccess.py
bash mktest.sh
