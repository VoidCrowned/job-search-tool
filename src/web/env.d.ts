// Build-time settings for the online version (see src/web/backend/index.ts).
interface ImportMetaEnv {
  /** "1" builds the online version: everything in the browser, job search via the relay. */
  readonly VITE_HOSTED?: string;
  /** The job-search relay (worker/), e.g. https://job-search-relay.example.workers.dev */
  readonly VITE_RELAY_URL?: string;
  /** Imprint text for the online version's privacy page (repository variable IMPRINT); none if empty. */
  readonly VITE_IMPRINT?: string;
}
