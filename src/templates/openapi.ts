/** The generated application's public contract. Keep route implementations and
 * contract tests aligned with this document. */
export const openApi = `openapi: 3.1.0
info:
  title: Composable SaaS API
  version: 1.0.0
  description: Provider-neutral API contract for generated SaaS applications.
servers:
  - url: /api/v1
paths:
  /health:
    get:
      operationId: health
      responses: { '200': { description: Healthy, content: { application/json: { schema: { $ref: '#/components/schemas/Health' } } } } }
  /auth/register:
    post:
      operationId: register
      requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/RegisterInput' } } } }
      responses: { '201': { $ref: '#/components/responses/Authenticated' }, '400': { $ref: '#/components/responses/BadRequest' }, '409': { $ref: '#/components/responses/Conflict' } }
  /auth/login:
    post:
      operationId: login
      requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/LoginInput' } } } }
      responses: { '200': { $ref: '#/components/responses/Authenticated' }, '401': { $ref: '#/components/responses/Unauthorized' } }
  /auth/logout:
    post:
      operationId: logout
      responses: { '204': { description: Logged out } }
  /users/me:
    get:
      operationId: currentUser
      security: [{ sessionCookie: [] }]
      responses: { '200': { description: Current user, content: { application/json: { schema: { $ref: '#/components/schemas/User' } } } }, '401': { $ref: '#/components/responses/Unauthorized' } }
    delete:
      operationId: deleteAccount
      security: [{ sessionCookie: [] }]
      responses: { '204': { description: Account deleted }, '401': { $ref: '#/components/responses/Unauthorized' } }
  /files:
    get:
      operationId: listFiles
      security: [{ sessionCookie: [] }]
      responses: { '200': { description: Files, content: { application/json: { schema: { type: object, required: [files], properties: { files: { type: array, items: { $ref: '#/components/schemas/File' } } } } } } }
    post:
      operationId: createFile
      security: [{ sessionCookie: [] }]
      requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/CreateFileInput' } } } }
      responses: { '201': { description: File created, content: { application/json: { schema: { $ref: '#/components/schemas/File' } } } }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' } }
components:
  securitySchemes:
    sessionCookie: { type: apiKey, in: cookie, name: session }
  responses:
    BadRequest: { description: Invalid request, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
    Unauthorized: { description: Authentication required, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
    Forbidden: { description: Insufficient role, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
    Conflict: { description: Conflict, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
    NotFound: { description: Resource not found, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
  schemas:
    Health: { type: object, required: [status], properties: { status: { type: string, enum: [ok] } } }
    Error: { type: object, required: [error, code], properties: { error: { type: string }, code: { type: string } } }
    RegisterInput: { type: object, required: [email, password], properties: { email: { type: string, format: email }, password: { type: string, minLength: 12 }, name: { type: string } } }
    LoginInput: { type: object, required: [email, password], properties: { email: { type: string, format: email }, password: { type: string } } }
    User: { type: object, required: [id, email, name], properties: { id: { type: string }, email: { type: string, format: email }, name: { type: string } } }
    Authenticated: { type: object, required: [user], properties: { user: { $ref: '#/components/schemas/User' } } }
    CreateFileInput: { type: object, required: [name, content], properties: { name: { type: string, minLength: 1 }, content: { type: string, contentEncoding: base64 } } }
    File: { type: object, required: [id, name, size, createdAt], properties: { id: { type: string }, name: { type: string }, size: { type: integer }, createdAt: { type: string, format: date-time } } }
`;
