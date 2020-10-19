
exports.handler = function (event, context) {
	console.log(event);
	context.succeed('hello ' + event.name);
};
