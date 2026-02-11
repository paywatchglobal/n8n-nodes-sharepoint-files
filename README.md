# @paywatchglobal/n8n-nodes-sharepoint-files

This is an n8n community node. It lets you use Microsoft SharePoint in your n8n workflows.

[SharePoint](https://www.microsoft.com/en-us/microsoft-365/sharepoint/collaboration) is Microsoft's cloud-based document management and collaboration platform. This node interacts with SharePoint files and folders via the [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/api/resources/driveitem).

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Usage](#usage)
[Resources](#resources)
[Version history](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

- **List** — List files and folders within a SharePoint folder. Supports pagination to retrieve all items.
- **Download** — Download a file from SharePoint by path or by item ID. Returns binary data that can be used in subsequent workflow nodes.
- **Upload** — Upload a file to SharePoint. Files up to 4 MB use a simple upload; larger files are automatically uploaded in 10 MB chunks via a resumable upload session.
- **Create Folder** — Create a new folder in a SharePoint drive.

All operations support dynamic selection of the target **Site**, **Drive**, and **Folder** through searchable dropdown menus or manual ID/path entry.

## Credentials

This node authenticates using **OAuth 2.0 Client Credentials** (service principal). You need an Azure AD / Microsoft Entra app registration with the appropriate Microsoft Graph application permissions for SharePoint.

### Prerequisites

1. Sign in to the [Azure Portal](https://portal.azure.com/).
2. Navigate to **Microsoft Entra ID > App registrations** and create a new registration (or use an existing one).
3. Under **API permissions**, add **Microsoft Graph > Application permissions**:
   - `Sites.Read.All` or `Sites.ReadWrite.All` (depending on your needs)
   - `Files.Read.All` or `Files.ReadWrite.All`
4. Grant admin consent for the permissions.
5. Under **Certificates & secrets**, create a new **Client secret** and note its value.

### Setting up credentials in n8n

In n8n, create a new **SharePoint Files API** credential and fill in:

| Field | Description |
|-------|-------------|
| **Tenant ID** | Your Azure AD / Microsoft Entra tenant ID |
| **Client ID** | The Application (client) ID from your app registration |
| **Client Secret** | The client secret value you created |

## Compatibility

Tested with n8n version 1.x. Requires n8n Node API version 1.

## Usage

### Selecting a site and drive

Each operation requires you to select a **Site** and a **Drive**. You can either search for them using the built-in dropdown or enter their IDs manually:

- **Site ID** format: `contoso.sharepoint.com,<guid>,<guid>`
- **Drive ID** format: `b!<base64-encoded-string>`

### Downloading files

You can identify the file to download either **by path** (e.g., `/Documents/report.pdf`) or **by item ID**. The downloaded file is stored in a binary property (default name: `data`) that you can pass to subsequent nodes.

### Uploading files

Pass binary data from a previous node (e.g., an HTTP Request or Read Binary File node) into the upload operation. Specify the target filename and folder path. Files larger than 4 MB are automatically chunked.

### Creating folders

Provide the folder name and the parent folder path. The operation will fail if a folder with the same name already exists in that location.

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* [Microsoft Graph DriveItem API reference](https://learn.microsoft.com/en-us/graph/api/resources/driveitem)
* [Microsoft Graph authentication: service principal](https://learn.microsoft.com/en-us/graph/auth-v2-service)
* [SharePoint documentation](https://learn.microsoft.com/en-us/sharepoint/)

## Version history

### 0.1.0

Initial release with support for listing, downloading, uploading, and creating folders in SharePoint sites.
