import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { S3Client } from "@aws-sdk/client-s3";
import { fromIni } from "@aws-sdk/credential-providers";

const credentials = fromIni({ profile: "tokenmaster" });
const region = process.env.AWS_REGION ?? "us-west-2";

export const bedrockRuntime = new BedrockRuntimeClient({ region, credentials });
export const s3 = new S3Client({ region, credentials });
