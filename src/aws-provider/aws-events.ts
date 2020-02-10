import { CloudWatchEvents } from 'aws-sdk';

import { PutEventsRequest } from 'aws-sdk/clients/cloudwatchevents';
import { ConsoleUtil } from '../console-util';

const eventSource = 'oc.org-formation';
const eventDetailType = 'events.org-formation.com';

export class AwsEvents {
    public static async putAccountCreatedEvent(accountId: string) {
        try {
            const events = new CloudWatchEvents({region: 'us-east-1'});
            const putEventsRequest: PutEventsRequest = {Entries: [
                {
                    Time: new Date(),
                    Resources: [accountId],
                    Source: eventSource,
                    DetailType: eventDetailType,
                    Detail: JSON.stringify({
                        eventName: 'AccountCreated',
                        accountId,
                    }),

                },
            ]};
            await events.putEvents(putEventsRequest).promise();
        } catch (err) {
            ConsoleUtil.LogError(`unable to put event AccountCreated for account ${accountId}`, err);
        }
    }
}
