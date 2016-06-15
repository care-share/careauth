#!/bin/sh

# if we are trying to access the FHIR server through the Docker hostname, resolve it to its IP address
FHIRPROXY=`echo $proxy_fhir | cut -f3 -d"/"`
if [ "$FHIRPROXY" = "fhir:8080" ] || [ "$FHIRPROXY" = "" ] ; then
  # get IP address of FHIR server
  export proxy_fhir=http://$(awk '/fhir/ {print $1}' /etc/hosts | tail -n 1):8080/baseDstu2
  echo "FHIR proxy target: $proxy_fhir"
fi

# start server
/usr/local/bin/npm start
