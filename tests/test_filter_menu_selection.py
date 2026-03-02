import json
import os
import re
import shutil
import subprocess
import unittest


ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
APP_JS_PATH = os.path.join(ROOT_DIR, "site", "app.js")


@unittest.skipUnless(shutil.which("node"), "node is required for JS unit tests")
class FilterMenuSelectionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        with open(APP_JS_PATH, "r", encoding="utf-8") as handle:
            app_js = handle.read()
        reduce_menu_selection_match = re.search(
            r"function reduceMenuSelection\(\{[\s\S]*?\n}\n",
            app_js,
        )
        if not reduce_menu_selection_match:
            raise AssertionError("Could not find reduceMenuSelection in site/app.js")
        cls.reduce_menu_selection_source = reduce_menu_selection_match.group(0)

    def _reduce_menu_selection(self, payload: dict) -> dict:
        script = (
            f"{self.reduce_menu_selection_source}\n"
            "const payload = JSON.parse(process.argv[1]);\n"
            "const args = {\n"
            "  ...payload,\n"
            "  selectedValues: new Set(payload.selectedValues || []),\n"
            "};\n"
            "const result = reduceMenuSelection(args);\n"
            "process.stdout.write(JSON.stringify({\n"
            "  allMode: result.allMode,\n"
            "  selectedValues: Array.from(result.selectedValues || []),\n"
            "}));\n"
        )
        completed = subprocess.run(
            ["node", "-e", script, json.dumps(payload)],
            check=True,
            capture_output=True,
            text=True,
        )
        return json.loads(completed.stdout)

    def test_click_all_toggles_off_explicit_all_selection(self) -> None:
        result = self._reduce_menu_selection(
            {
                "rawValue": "all",
                "allMode": False,
                "selectedValues": ["Run", "Ride"],
                "allValues": ["Run", "Ride"],
                "allowToggleOffAll": True,
            }
        )
        self.assertFalse(result["allMode"])
        self.assertEqual(result["selectedValues"], [])

    def test_click_all_from_partial_selection_switches_to_all_mode(self) -> None:
        result = self._reduce_menu_selection(
            {
                "rawValue": "all",
                "allMode": False,
                "selectedValues": ["Run"],
                "allValues": ["Run", "Ride"],
                "allowToggleOffAll": True,
            }
        )
        self.assertTrue(result["allMode"])
        self.assertEqual(result["selectedValues"], [])

    def test_click_all_from_all_mode_toggles_off_when_enabled(self) -> None:
        result = self._reduce_menu_selection(
            {
                "rawValue": "all",
                "allMode": True,
                "selectedValues": [],
                "allValues": ["Run", "Ride"],
                "allowToggleOffAll": True,
            }
        )
        self.assertFalse(result["allMode"])
        self.assertEqual(result["selectedValues"], [])


if __name__ == "__main__":
    unittest.main()
