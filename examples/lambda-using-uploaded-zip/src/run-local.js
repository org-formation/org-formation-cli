const lambda = require('./index');

const event = {name: 'me'};
const context = {
    succeed: (x) => console.log(`succeeded: ${x}`)
}
lambda.handler(event, context)