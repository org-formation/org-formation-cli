# release version passed in on build, just default it temporarily
ARG         RELEASE_VERSION=0.0.1

FROM        node:13.10-alpine3.11
RUN         npm install -g --production aws-organization-formation@${RELEASE_VERSION}
WORKDIR     /workdir
ENV         AWS_PROFILE=default
ENTRYPOINT  [ "org-formation" ]
