import json
import os
import re
import shutil
import subprocess
import unittest


ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
APP_JS_PATH = os.path.join(ROOT_DIR, "site", "app.js")


@unittest.skipUnless(shutil.which("node"), "node is required for JS unit tests")
class RepoLinkInferenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        with open(APP_JS_PATH, "r", encoding="utf-8") as handle:
            app_js = handle.read()
        infer_match = re.search(
            r"function inferGitHubRepoFromLocation\(loc\)\s*{[\s\S]*?\n}\n",
            app_js,
        )
        parse_match = re.search(
            r"function parseGitHubRepo\(value\)\s*{[\s\S]*?\n}\n",
            app_js,
        )
        resolve_match = re.search(
            r"function resolveGitHubRepo\(loc, fallbackRepo\)\s*{[\s\S]*?\n}\n",
            app_js,
        )
        if not infer_match or not parse_match or not resolve_match:
            raise AssertionError("Could not find repo inference helpers in site/app.js")
        cls.parse_source = parse_match.group(0)
        cls.infer_source = infer_match.group(0)
        cls.resolve_source = resolve_match.group(0)

    def _resolve_repo(self, hostname: str, pathname: str, fallback_repo=None):
        script = (
            f"{self.parse_source}\n"
            f"{self.infer_source}\n"
            f"{self.resolve_source}\n"
            "const payload = JSON.parse(process.argv[1]);\n"
            "const result = resolveGitHubRepo(payload.loc, payload.fallback);\n"
            "process.stdout.write(JSON.stringify(result));\n"
        )
        completed = subprocess.run(
            [
                "node",
                "-e",
                script,
                json.dumps({
                    "loc": {"hostname": hostname, "pathname": pathname},
                    "fallback": fallback_repo,
                }),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        return json.loads(completed.stdout)

    def test_infers_project_pages_repo(self) -> None:
        result = self._resolve_repo("aspain.github.io", "/git-sweaty/")
        self.assertEqual(result, {"owner": "aspain", "repo": "git-sweaty"})

    def test_infers_user_pages_repo_at_root(self) -> None:
        result = self._resolve_repo("aspain.github.io", "/")
        self.assertEqual(result, {"owner": "aspain", "repo": "aspain.github.io"})

    def test_infers_github_com_repo(self) -> None:
        result = self._resolve_repo("github.com", "/aspain/git-sweaty/")
        self.assertEqual(result, {"owner": "aspain", "repo": "git-sweaty"})

    def test_custom_domain_uses_payload_repo_slug_fallback(self) -> None:
        result = self._resolve_repo("subdomain.example.com", "/", "owner/repo")
        self.assertEqual(result, {"owner": "owner", "repo": "repo"})

    def test_custom_domain_uses_payload_repo_url_fallback(self) -> None:
        result = self._resolve_repo("subdomain.example.com", "/", "https://github.com/owner/repo")
        self.assertEqual(result, {"owner": "owner", "repo": "repo"})

    def test_custom_domain_returns_null_without_fallback(self) -> None:
        result = self._resolve_repo("subdomain.example.com", "/")
        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
