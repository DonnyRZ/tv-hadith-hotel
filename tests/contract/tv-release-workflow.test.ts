import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const workflowPath = resolve(process.cwd(), '.github/workflows/tv-release.yml');
const workflowSource = readFileSync(workflowPath, 'utf8');
const workflow = parse(workflowSource) as {
  on?: {
    push?: { tags?: string[] };
    pull_request?: unknown;
  };
  jobs?: Record<
    string,
    {
      environment?: string;
      steps?: Array<{ name?: string; run?: string }>;
      outputs?: Record<string, unknown>;
    }
  >;
};

describe('EGI TV release workflow', () => {
  it('runs only from an explicit release tag or manual recovery dispatch', () => {
    expect(workflow.on?.push?.tags).toContain('tv-v*-code*');
    expect(workflow.on?.pull_request).toBeUndefined();
    expect(workflow.jobs?.['build-release']?.environment).toBe('tv-release');
  });

  it('uses the repository release gate and exposes verified release metadata', () => {
    const buildSteps = workflow.jobs?.['build-release']?.steps ?? [];
    const buildCommands = buildSteps.map((step) => step.run ?? '').join('\n');

    expect(buildCommands).toContain('tools/tv/package-tv.ps1');
    expect(workflow.jobs?.['build-release']?.outputs).toEqual(
      expect.objectContaining({
        artifact_name: expect.any(String),
        version_code: expect.any(String),
        update_apk_url: expect.any(String),
        release_id: expect.any(String),
        autopublish: expect.any(String),
        commit_sha: expect.any(String),
      }),
    );
    expect(workflowSource).toContain('TV_SIGNING_KEYSTORE_BASE64');
    expect(workflowSource).not.toContain('pull_request_target');
  });

  it('is fail-closed for protected main-based releases and immutable promotion', () => {
    expect(workflowSource).toContain('group: egi-tv-production-release');
    expect(workflowSource).toContain('git merge-base --is-ancestor');
    expect(workflowSource).toContain('github.ref_protected');
    expect(workflowSource).toContain('put_immutable');
    expect(workflowSource).toContain('--skip-deploys');
    expect(workflowSource).toContain('railway service redeploy');
    expect(workflowSource).toContain('tools/verify-tv-release.mjs');
  });
});
