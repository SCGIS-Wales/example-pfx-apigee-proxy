try {
    // Extract form data from request
    var pfxBase64 = context.getVariable('request.formparam.pfxFile');
    var pfxPassword = context.getVariable('request.formparam.pfxPassword');
    var targetUrl = context.getVariable('request.formparam.targetUrl');
    var targetPath = context.getVariable('request.formparam.targetPath') || '/'; // Default to '/' if not provided
    var targetMethod = context.getVariable('request.formparam.targetMethod') || 'GET'; // Default to 'GET' if not provided
    var tlsVersion = context.getVariable('request.formparam.tlsVersion') || 'TLSv1_2_method'; // Default to TLS 1.2

    // Decode the Base64 encoded PFX file
    var pfxFile = base64.decode(pfxBase64);

    // Parse the PFX file
    var pkcs12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(pfxFile), false, pfxPassword);

    var keyObj, certObj;
    pkcs12.safeContents.forEach(function(safeContents) {
        safeContents.safeBags.forEach(function(safeBag) {
            if (safeBag.type === forge.pki.oids.certBag) {
                certObj = forge.pki.certificateToPem(safeBag.cert);
            } else if (safeBag.type === forge.pki.oids.keyBag) {
                keyObj = forge.pki.privateKeyToPem(safeBag.key);
            }
        });
    });

    // Validate that both key and certificate are extracted
    if (!keyObj || !certObj) {
        throw new Error("Invalid PFX file or password. Could not extract key and certificate.");
    }

    // Set extracted key and certificate to context variables
    context.setVariable('privateKey', keyObj);
    context.setVariable('certificate', certObj);

    // Extract hostname from the target URL
    var url = new URL(targetUrl);
    var hostname = url.hostname;

    // DNS Resolution Test
    dns.resolve(hostname, function(err, addresses) {
        if (err) {
            context.setVariable('dnsResolution', 'Failed: ' + err.message);
        } else {
            context.setVariable('dnsResolution', 'Success: ' + addresses.join(', '));

            // Connectivity Test and TLS Handshake
            var options = {
                hostname: hostname,
                port: 443,
                path: targetPath,
                method: targetMethod,
                key: keyObj,
                cert: certObj,
                rejectUnauthorized: false, // For testing only. Set to true in production.
                secureProtocol: tlsVersion // Specify TLS version
            };

            var req = https.request(options, function(res) {
                context.setVariable('tlsResponseCode', res.statusCode);
                context.setVariable('tlsResponseMessage', res.statusMessage);
                res.on('data', function(chunk) {
                    // Consume response data to free up memory
                });
                res.on('end', function() {
                    context.setVariable('tlsHandshake', 'Success');
                });
            });

            req.on('error', function(e) {
                context.setVariable('tlsHandshake', 'Failed: ' + e.message);
            });

            req.end();
        }
    });

} catch (e) {
    // Handle errors
    context.setVariable('error', e.message);
    context.setVariable('dnsResolution', 'N/A');
    context.setVariable('tlsHandshake', 'Failed');
    context.setVariable('tlsResponseCode', 'N/A');
    context.setVariable('tlsResponseMessage', 'N/A');
}
