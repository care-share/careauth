#!/bin/bash

# This script is used to generate an ECDSA key and certificate request
# This is to comply with NSA Suite B cryptography specifications
# More info here: https://tools.ietf.org/html/rfc5430
# This requires openssl version 1.0.1e or greater

# Step 1: Set our Domain for a Wildcard certificate
DOMAIN="vacareshare.org"
WILD="*.$DOMAIN"
echo "Generating new ECDSA key and Certificate Signing Request for '$DOMAIN'..."

# Step 2: Set our Certificate Signing Request (CSR) variables
SUBJ="
C=
ST=
O=
localityName=
commonName=$WILD
organizationalUnitName=
emailAddress=
"

# Step 3: Create a folder for the key and CSR
DIR=`date +%Y-%m-%dT%H.%M.%S`
mkdir -p "$DIR"

# Step 4: Generate an ECDSA key with the secp384r1(24) elliptic curve that Suite B requires
openssl ecparam -out "$DIR/key.pem" -name secp384r1 -genkey

# Step 5: Using the key, generate a new Certificate Signing Request (CSR)
openssl req -new -subj "$(echo -n "$SUBJ" | tr "\n" "/")" -config ./openssl.cnf -key "$DIR/key.pem" -out "$DIR/csr.pem" -sha384

# Step 6 (optional): Display the CSR in readable format
openssl req -in "$DIR/csr.pem" -out "$DIR/csr.txt" -text

# Step 7: Set a password for this key
openssl ec -in "$DIR/key.pem" -des3 -out "$DIR/key.pem"

# Step 8: Secure the file permissions
chmod 600 "$DIR/key.pem"
chmod 600 "$DIR/csr.pem"
chmod 600 "$DIR/csr.txt"

# Step 9: Send the CSR to a CA to get it signed!
echo ""
echo "Done! Send the Certificate Signing Request to your Certificate Authority to get it signed!"

# Later, use the following command to convert the key and certificate to a PFX/PKCS12 bundle
# openssl pkcs12 -export -in cert.pem -inkey key.pem -out key-and-cert.pfx

# To export the private key from a PFX file (REMOVES PASSWORD):
# openssl pkcs12 -in key-and-cert.pfx -nocerts -out key.pem -nodes

# To export the certificate from a PFX file:
# openssl pkcs12 -in key-and-cert.pfx -nokeys -out cert.pem

# To read a certificate in text format:
# openssl x509 -in cert.pem -noout -text > cert.txt
