// Shared test setup. Under heavy parallel load (full test run, slow CI machine) the first render of a page can
// take longer than testing-library's default 1 s for findBy…/waitFor, which made tests fail now and then.
import { configure } from '@testing-library/react';

configure({ asyncUtilTimeout: 5000 });
