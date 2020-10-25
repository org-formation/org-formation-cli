const logger = require('./logger')

exports.handler = function (event, context) {
	logger.log(event);
	context.succeed('hello ' + event.name);
};
