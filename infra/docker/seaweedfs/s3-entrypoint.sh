#!/bin/sh
# Gera a configuração de credenciais S3 a partir das variáveis de ambiente
# e sobe o SeaweedFS com o gateway S3 na porta 8333.
set -eu

cat > /tmp/s3.json <<EOF
{
  "identities": [
    {
      "name": "cvpilot",
      "credentials": [{ "accessKey": "${S3_ACCESS_KEY}", "secretKey": "${S3_SECRET_KEY}" }],
      "actions": ["Admin", "Read", "Write", "List", "Tagging"]
    }
  ]
}
EOF

exec weed server -dir=/data -s3 -s3.port=8333 -s3.config=/tmp/s3.json -master.volumeSizeLimitMB=1024
