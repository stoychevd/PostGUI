FROM node:14.7.0

WORKDIR /opt/app

COPY . ./

RUN npm install

RUN npx browserslist@latest --update-db
RUN /bin/sh -c npm run
WORKDIR /opt/app/build

CMD ["/bin/sh", "-c", "npm start"]


