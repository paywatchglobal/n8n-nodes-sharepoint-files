import type {
	ICredentialTestFunctions,
	ICredentialsDecrypted,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeCredentialTestResult,
	INodeExecutionData,
	INodeListSearchResult,
	INodeParameterResourceLocator,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import {
	microsoftGraphApiRequest,
	microsoftGraphApiRequestAllItems,
	microsoftGraphApiRequestBinary,
} from './GenericFunctions';

const UPLOAD_CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB
const SIMPLE_UPLOAD_LIMIT = 4 * 1024 * 1024; // 4 MB

export class SharePointFiles implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SharePoint Files',
		name: 'sharePointFiles',
		icon: 'file:sharepoint.svg',
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Manage files and folders in SharePoint sites via Microsoft Graph API',
		defaults: {
			name: 'SharePoint Files',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'sharePointFilesApi',
				required: true,
				testedBy: 'sharePointFilesApiTest',
			},
		],
		properties: [
			// ------ Operation ------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Create Folder',
						value: 'createFolder',
						description: 'Create a new folder',
						action: 'Create a folder',
					},
					{
						name: 'Download',
						value: 'download',
						description: 'Download a file',
						action: 'Download a file',
					},
					{
						name: 'List',
						value: 'list',
						description: 'List files and folders',
						action: 'List files and folders',
					},
					{
						name: 'Upload',
						value: 'upload',
						description: 'Upload a file',
						action: 'Upload a file',
					},
				],
				default: 'list',
			},
			// ------ Common Parameters ------
			{
				displayName: 'Site',
				name: 'siteId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'searchSites',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. contoso.sharepoint.com,guid,guid',
					},
				],
			},
			{
				displayName: 'Drive',
				name: 'driveId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'searchDrives',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. b!abc123...',
					},
				],
			},
			{
				displayName: 'Folder',
				name: 'folderPath',
				type: 'resourceLocator',
				default: { mode: 'list', value: '/' },
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'searchFolders',
							searchable: true,
						},
					},
					{
						displayName: 'By Path',
						name: 'path',
						type: 'string',
						placeholder: 'e.g. /Documents/Reports',
					},
				],
			},
			// ------ Download ------
			{
				displayName: 'File',
				name: 'file',
				type: 'resourceLocator',
				default: { mode: 'id', value: '' },
				required: true,
				displayOptions: { show: { operation: ['download'] } },
				modes: [
					{
						displayName: 'By Path',
						name: 'path',
						type: 'string',
						placeholder: 'e.g. /Documents/report.pdf',
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. 01ABC123DEF456...',
					},
				],
			},
			{
				displayName: 'Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				displayOptions: { show: { operation: ['download'] } },
				description: 'Name of the binary property to write the downloaded file to',
			},
			// ------ Upload ------
			{
				displayName: 'Input Binary Property',
				name: 'inputBinaryPropertyName',
				type: 'string',
				default: 'data',
				displayOptions: { show: { operation: ['upload'] } },
				description: 'Name of the binary property containing the file data to upload',
			},
			{
				displayName: 'File Name',
				name: 'fileName',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['upload'] } },
				description:
					'Name for the uploaded file. If empty, the original file name from the binary data is used.',
			},
			// ------ Create Folder ------
			{
				displayName: 'Folder Name',
				name: 'folderName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['createFolder'] } },
				description: 'Name of the new folder to create',
			},
		],
	};

	methods: INodeType['methods'] = {
		credentialTest: {
			async sharePointFilesApiTest(
				this: ICredentialTestFunctions,
				credential: ICredentialsDecrypted,
			): Promise<INodeCredentialTestResult> {
				const { tenantId, clientId, clientSecret } = credential.data as {
					tenantId: string;
					clientId: string;
					clientSecret: string;
				};

				try {
					// eslint-disable-next-line @n8n/community-nodes/no-deprecated-workflow-functions
					const tokenRaw = (await this.helpers.request({
						method: 'POST',
						uri: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
						form: {
							grant_type: 'client_credentials',
							client_id: clientId,
							client_secret: clientSecret,
							scope: 'https://graph.microsoft.com/.default',
						},
					})) as string;

					let tokenResponse: { access_token: string };
					try {
						tokenResponse = JSON.parse(tokenRaw) as { access_token: string };
					} catch {
						tokenResponse = tokenRaw as unknown as { access_token: string };
					}

					if (!tokenResponse.access_token) {
						return {
							status: 'Error',
							message: `Token response missing access_token: ${JSON.stringify(tokenResponse).substring(0, 200)}`,
						};
					}

					// eslint-disable-next-line @n8n/community-nodes/no-deprecated-workflow-functions
					await this.helpers.request({
						method: 'GET',
						uri: 'https://graph.microsoft.com/v1.0/sites/root',
						headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
					});

					return { status: 'OK', message: 'Connection successful' };
				} catch (error) {
					const err = error as Error & { statusCode?: number; message?: string };
					return {
						status: 'Error',
						message: `${err.statusCode ?? ''} ${err.message}`.trim(),
					};
				}
			},
		},
		listSearch: {
			async searchSites(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				const query = filter || '*';
				const response = (await microsoftGraphApiRequest.call(
					this,
					'GET',
					`/sites?search=${encodeURIComponent(query)}`,
				)) as JsonObject;

				const sites = (response.value as Array<{ displayName: string; id: string; webUrl?: string }>) || [];
				return {
					results: sites.map((site) => ({
						name: site.displayName,
						value: site.id,
						url: site.webUrl,
					})),
				};
			},

			async searchDrives(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				const siteId = String((this.getNodeParameter('siteId') as INodeParameterResourceLocator).value ?? '');
				if (!siteId) return { results: [] };

				const response = (await microsoftGraphApiRequest.call(
					this,
					'GET',
					`/sites/${siteId}/drives`,
				)) as JsonObject;

				const drives = (response.value as Array<{ name: string; id: string; webUrl?: string }>) || [];
				let results = drives.map((drive) => ({
					name: drive.name,
					value: drive.id,
					url: drive.webUrl,
				}));

				if (filter) {
					const lowerFilter = filter.toLowerCase();
					results = results.filter((r) => r.name.toLowerCase().includes(lowerFilter));
				}

				return { results };
			},

			async searchFolders(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				const driveId = String((this.getNodeParameter('driveId') as INodeParameterResourceLocator).value ?? '');
				if (!driveId) return { results: [] };

				// Use filter as parent path — list folders 1 level below it
				const parentPath = (filter ?? '').trim();
				const endpoint =
					!parentPath || parentPath === '/'
						? `/drives/${driveId}/root/children`
						: `/drives/${driveId}/root:${parentPath.startsWith('/') ? parentPath : `/${parentPath}`}:/children`;

				const prefix = !parentPath || parentPath === '/' ? '' : parentPath;

				const results: Array<{ name: string; value: string }> = [
					{ name: '/ (Root)', value: '/' },
				];

				const response = (await microsoftGraphApiRequest.call(
					this,
					'GET',
					endpoint,
				)) as JsonObject;

				const items =
					(response.value as Array<{
						name: string;
						folder?: object;
					}>) || [];

				for (const item of items) {
					if (item.folder !== undefined) {
						const path = `${prefix}/${item.name}`;
						results.push({ name: path, value: path });
					}
				}

				return { results };
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				const driveId = extractResourceLocatorValue(this, 'driveId', i);
				const folderEndpoint = buildFolderEndpoint(this, i, driveId);

				if (operation === 'list') {
					const children = await microsoftGraphApiRequestAllItems.call(
						this,
						'GET',
						`${folderEndpoint}/children`,
					);

					for (const child of children) {
						returnData.push({ json: child, pairedItem: { item: i } });
					}
				} else if (operation === 'download') {
					const fileEndpoint = buildFileEndpoint(this, i, driveId);

					const metadata = await microsoftGraphApiRequest.call(
						this,
						'GET',
						fileEndpoint,
					);

					const contentEndpoint =
						fileEndpoint.includes('/items/')
							? `${fileEndpoint}/content`
							: `${fileEndpoint}:/content`;

					const binaryData = await microsoftGraphApiRequestBinary.call(
						this,
						'GET',
						contentEndpoint,
					);

					const binaryPropertyName = this.getNodeParameter(
						'binaryPropertyName',
						i,
					) as string;
					const fileName = (metadata.name as string) || 'download';
					const mimeType =
						((metadata.file as Record<string, unknown>)?.mimeType as string) ||
						'application/octet-stream';

					const binary = await this.helpers.prepareBinaryData(
						Buffer.from(binaryData),
						fileName,
						mimeType,
					);

					returnData.push({
						json: metadata,
						binary: { [binaryPropertyName]: binary },
						pairedItem: { item: i },
					});
				} else if (operation === 'upload') {
					const inputBinaryPropertyName = this.getNodeParameter(
						'inputBinaryPropertyName',
						i,
					) as string;

					const binaryData = this.helpers.assertBinaryData(i, inputBinaryPropertyName);
					const buffer = await this.helpers.getBinaryDataBuffer(
						i,
						inputBinaryPropertyName,
					);

					const fileName =
						(this.getNodeParameter('fileName', i) as string) ||
						binaryData.fileName ||
						'upload';

					const folderPath = normalizeFolderPath(this, i);

					if (buffer.length <= SIMPLE_UPLOAD_LIMIT) {
						const uploadEndpoint =
							folderPath === '/'
								? `/drives/${driveId}/root:/${encodeURIComponent(fileName)}:/content`
								: `/drives/${driveId}/root:${folderPath}/${encodeURIComponent(fileName)}:/content`;

						const response = await microsoftGraphApiRequest.call(
							this,
							'PUT',
							uploadEndpoint,
							buffer as unknown as object,
							{},
							{ 'Content-Type': binaryData.mimeType || 'application/octet-stream' },
						);

						returnData.push({ json: response, pairedItem: { item: i } });
					} else {
						const sessionEndpoint =
							folderPath === '/'
								? `/drives/${driveId}/root:/${encodeURIComponent(fileName)}:/createUploadSession`
								: `/drives/${driveId}/root:${folderPath}/${encodeURIComponent(fileName)}:/createUploadSession`;

						const session = await microsoftGraphApiRequest.call(
							this,
							'POST',
							sessionEndpoint,
							{
								item: {
									'@microsoft.graph.conflictBehavior': 'replace',
									name: fileName,
								},
							},
						);

						const uploadUrl = session.uploadUrl as string;
						const fileSize = buffer.length;
						let start = 0;
						let response: JsonObject = {};

						while (start < fileSize) {
							const end = Math.min(start + UPLOAD_CHUNK_SIZE, fileSize);
							const chunk = buffer.subarray(start, end);

							response = (await this.helpers.httpRequest({
								method: 'PUT',
								url: uploadUrl,
								headers: {
									'Content-Length': chunk.length.toString(),
									'Content-Range': `bytes ${start}-${end - 1}/${fileSize}`,
								},
								body: chunk,
								encoding: 'arraybuffer',
								json: false,
								returnFullResponse: true,
							})) as unknown as JsonObject;

							start = end;
						}

						returnData.push({ json: response, pairedItem: { item: i } });
					}
				} else if (operation === 'createFolder') {
					const folderName = this.getNodeParameter('folderName', i) as string;

					const response = await microsoftGraphApiRequest.call(
						this,
						'POST',
						`${folderEndpoint}/children`,
						{
							name: folderName,
							folder: {},
							'@microsoft.graph.conflictBehavior': 'fail',
						},
					);

					returnData.push({ json: response, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}

function extractResourceLocatorValue(
	context: IExecuteFunctions,
	paramName: string,
	itemIndex: number,
): string {
	const param = context.getNodeParameter(paramName, itemIndex) as INodeParameterResourceLocator;
	return String(param.value ?? '');
}

function normalizeFolderPath(context: IExecuteFunctions, itemIndex: number): string {
	const param = context.getNodeParameter('folderPath', itemIndex) as INodeParameterResourceLocator;
	const folderPath = String(param.value ?? '/').trim();
	if (!folderPath || folderPath === '/') return '/';
	return folderPath.startsWith('/') ? folderPath : `/${folderPath}`;
}

function buildFolderEndpoint(
	context: IExecuteFunctions,
	itemIndex: number,
	driveId: string,
): string {
	const folderPath = normalizeFolderPath(context, itemIndex);

	if (folderPath === '/') {
		return `/drives/${driveId}/root`;
	}

	return `/drives/${driveId}/root:${folderPath}:`;
}

function buildFileEndpoint(
	context: IExecuteFunctions,
	itemIndex: number,
	driveId: string,
): string {
	const param = context.getNodeParameter('file', itemIndex) as INodeParameterResourceLocator;
	const mode = param.mode;
	const value = String(param.value ?? '').trim();

	if (mode === 'id') {
		return `/drives/${driveId}/items/${value}`;
	}

	// path mode — if it's a full path (starts with /), use as-is;
	// otherwise treat as filename relative to the selected folder
	if (value.startsWith('/')) {
		return `/drives/${driveId}/root:${value}`;
	}

	const folderPath = normalizeFolderPath(context, itemIndex);
	const fullPath = folderPath === '/' ? `/${value}` : `${folderPath}/${value}`;
	return `/drives/${driveId}/root:${fullPath}`;
}
