import { CredentialProviderChain, Credentials, FileSystemCredentials, AWSError } from "aws-sdk";
import { inherits } from "util";


console.log('hellow');

class myCreds extends Credentials {
    refresh(callback: (err: AWSError) => void) {
        callback(new Error('abcv') as AWSError);
    }
}


const fn = (): Credentials => {
    return new myCreds(undefined);
}

const x = CredentialProviderChain.defaultProviders;
const y = new CredentialProviderChain(
    [
        fn,
        ...CredentialProviderChain.defaultProviders,
        fn,
    ]
)

y.resolvePromise().then(x=>console.log(x));