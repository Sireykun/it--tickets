FROM rinkp/osticket-dockerized@sha256:43163dda84304a178f5849eddb0bef2207758bce8b08380b61c3599ce2f9bc47

# Keep the base image's environment installer while replacing its osTicket files.
COPY --chown=apache:apache osTicket-develop-patches/ /var/www/localhost/htdocs/
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD php -r 'exit(@file_get_contents("http://127.0.0.1/") === false ? 1 : 0);'
