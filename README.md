# example-pfx-apigee-proxy

Example request


```bash
curl -X POST https://your-apigee-domain/mtlsproxy \
  -F "pfxFile=@path/to/your/client.pfx" \
  -F "pfxPassword=yourpassword" \
  -F "targetUrl=https://target-mtls-server.com" \
  -F "targetPath=/endpoint" \
  -F "targetMethod=POST" \
  -F "tlsVersion=TLSv1_3_method"
```