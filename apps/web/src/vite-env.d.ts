/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_API_CUSTOMERS_PATH: string
  readonly VITE_API_DELETED_CUSTOMERS_PATH: string
  readonly VITE_API_CUSTOMER_RESTORE_PATH: string
  readonly VITE_API_CUSTOMER_PERMANENT_DELETE_PATH: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
