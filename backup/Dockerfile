FROM alpine:3.19

RUN apk add --no-cache \
    bash \
    postgresql16-client \
    aws-cli \
    gzip \
    curl \
    coreutils

WORKDIR /backup

COPY backup.sh restore.sh ./
RUN chmod +x backup.sh restore.sh

CMD ["./backup.sh"]
