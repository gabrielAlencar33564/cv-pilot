#!/bin/sh
# Sobe o SeaweedFS com o gateway S3 na porta 8333 e garante o bucket da aplicação.
#
# A identidade das apps só lê, grava e lista o bucket S3_BUCKET. Criar bucket exige a ação
# Admin no SeaweedFS, por isso o bucket é criado aqui pelo `weed shell`, que fala direto com
# o filer, sem passar pelas credenciais S3.
set -eu

: "${S3_ACCESS_KEY:?defina S3_ACCESS_KEY}"
: "${S3_SECRET_KEY:?defina S3_SECRET_KEY}"
: "${S3_BUCKET:?defina S3_BUCKET}"

MASTER=127.0.0.1:9333
BUCKET_WAIT_SECONDS=60

cat > /tmp/s3.json <<EOF
{
  "identities": [
    {
      "name": "cvpilot",
      "credentials": [{ "accessKey": "${S3_ACCESS_KEY}", "secretKey": "${S3_SECRET_KEY}" }],
      "actions": ["Read:${S3_BUCKET}", "Write:${S3_BUCKET}", "List:${S3_BUCKET}"]
    }
  ]
}
EOF

# -ip.bind=0.0.0.0: sem isso o SeaweedFS escuta só no IP do container, e o weed shell e o
# healthcheck usam 127.0.0.1
weed server -dir=/data -ip.bind=0.0.0.0 -s3 -s3.port=8333 -s3.config=/tmp/s3.json \
  -master.volumeSizeLimitMB=1024 &
weed_pid=$!

# O sh é o PID 1: repassa o `docker stop` para o SeaweedFS desligar sem perder escrita.
trap 'kill -TERM "$weed_pid" 2>/dev/null' TERM INT

# cada linha do s3.bucket.list é "  <bucket>\tsize:...": casa o nome exato, não um prefixo
bucket_exists() {
  echo 's3.bucket.list' | weed shell -master="$MASTER" 2>/dev/null |
    grep -q "[[:space:]]${S3_BUCKET}[[:space:]]"
}

waited=0
until bucket_exists; do
  kill -0 "$weed_pid" 2>/dev/null || { echo "SeaweedFS parou antes de criar o bucket" >&2; exit 1; }
  if [ "$waited" -ge "$BUCKET_WAIT_SECONDS" ]; then
    echo "bucket ${S3_BUCKET} não foi criado em ${BUCKET_WAIT_SECONDS}s" >&2
    kill -TERM "$weed_pid"
    exit 1
  fi
  # falha enquanto o filer ainda sobe; o laço confere de novo com bucket_exists
  echo "s3.bucket.create -name ${S3_BUCKET}" | weed shell -master="$MASTER" >/dev/null 2>&1 || true
  sleep 1
  waited=$((waited + 1))
done
echo "bucket ${S3_BUCKET} pronto"

# O primeiro wait volta quando chega o sinal; o segundo espera o SeaweedFS terminar de desligar.
status=0
wait "$weed_pid" || status=$?
if kill -0 "$weed_pid" 2>/dev/null; then
  status=0
  wait "$weed_pid" || status=$?
fi
exit "$status"
