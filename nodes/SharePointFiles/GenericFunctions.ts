import type {
	ICredentialDataDecryptedObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

const BASE_URL = 'https://graph.microsoft.com/v1.0';

async function getAccessToken(
	context: IExecuteFunctions | ILoadOptionsFunctions,
): Promise<string> {
	const credentials = (await context.getCredentials('sharePointFilesApi')) as ICredentialDataDecryptedObject;
	const { tenantId, clientId, clientSecret } = credentials as {
		tenantId: string;
		clientId: string;
		clientSecret: string;
	};

	const body = new URLSearchParams({
		grant_type: 'client_credentials',
		client_id: clientId,
		client_secret: clientSecret,
		scope: 'https://graph.microsoft.com/.default',
	}).toString();

	const response = (await context.helpers.httpRequest({
		method: 'POST',
		url: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body,
	})) as { access_token: string };

	return response.access_token;
}

export async function microsoftGraphApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: object = {},
	qs: Record<string, string> = {},
	headers: Record<string, string> = {},
): Promise<JsonObject> {
	const token = await getAccessToken(this);

	const options: IHttpRequestOptions = {
		method,
		url: `${BASE_URL}${endpoint}`,
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
			...headers,
		},
		qs,
		body,
		json: true,
	};

	if (method === 'GET' || Object.keys(body).length === 0) {
		delete options.body;
	}

	try {
		return (await this.helpers.httpRequest(options)) as JsonObject;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

export async function microsoftGraphApiRequestAllItems(
	this: IExecuteFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: object = {},
	qs: Record<string, string> = {},
): Promise<JsonObject[]> {
	const results: JsonObject[] = [];
	const token = await getAccessToken(this);

	let response = await microsoftGraphApiRequest.call(this, method, endpoint, body, qs);
	results.push(...((response.value as JsonObject[]) || []));

	while (response['@odata.nextLink']) {
		const nextUrl = response['@odata.nextLink'] as string;
		const options: IHttpRequestOptions = {
			method,
			url: nextUrl,
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
			json: true,
		};

		try {
			response = (await this.helpers.httpRequest(options)) as JsonObject;
		} catch (error) {
			throw new NodeApiError(this.getNode(), error as JsonObject);
		}

		results.push(...((response.value as JsonObject[]) || []));
	}

	return results;
}

export async function microsoftGraphApiRequestBinary(
	this: IExecuteFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
): Promise<Buffer> {
	const token = await getAccessToken(this);

	const options: IHttpRequestOptions = {
		method,
		url: `${BASE_URL}${endpoint}`,
		headers: {
			Authorization: `Bearer ${token}`,
		},
		encoding: 'arraybuffer',
		json: false,
	};

	try {
		return (await this.helpers.httpRequest(options)) as Buffer;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}
