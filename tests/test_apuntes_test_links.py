"""Comprobaciones aisladas de los enlaces test por apunte de BCPOL.es.

Ejecutar: python -m unittest discover -s tests -v
No se necesita acceso a servicios externos ni credenciales.
"""
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
HTML = (ROOT / "apuntes.html").read_text(encoding="utf-8")
MAP_RE = re.compile(r'"(trafico|administrativa|seguridad):(\d+)"\s*:\s*"(apunte_[a-z]+_\d+)"')
EXPECTED = {
    ("trafico", "9"): "apunte_trafico_9",
    ("administrativa", "9"): "apunte_administrativa_9",
    ("seguridad", "95"): "apunte_seguridad_95",
}


class TestPorApunteWeb(unittest.TestCase):
    def test_only_three_authorized_pilots_visible(self):
        found = {(m, n): payload for m, n, payload in MAP_RE.findall(HTML)}
        self.assertEqual(found, EXPECTED)
        self.assertEqual(len(MAP_RE.findall(HTML)), 3)

    def test_telegram_link_matches_bot_payload_contract(self):
        self.assertIn('const BOT_TEST_URL="https://t.me/BCPOLTEST_bot?start=";', HTML)
        self.assertIn('test.href=BOT_TEST_URL+encodeURIComponent(payload);', HTML)
        self.assertIn('const payload=TEST_POR_APUNTE[materia+":"+String(item.tema_id)];', HTML)

    def test_button_is_conditional_and_safely_created(self):
        self.assertIn('if(payload){', HTML)
        self.assertIn('elem("a","btn test-apunte","🧠 Hacer test")', HTML)
        self.assertIn('test.target="_blank";test.rel="noopener noreferrer";', HTML)
        self.assertIn('test.setAttribute("aria-label"', HTML)

    def test_existing_study_and_podcast_features_untouched(self):
        self.assertIn('toggleMark(item,mark)', HTML)
        self.assertIn('safeDrive(item.audio_url)', HTML)
        self.assertIn('api("mark"', HTML)
        self.assertIn('api("list")', HTML)

    def test_link_not_shown_until_login_succeeds(self):
        self.assertIn('if(!token){error("Para ver los apuntes necesitas iniciar sesión.");return;}', HTML)
        self.assertIn('$("status").hidden=true;$("library").hidden=false;', HTML)

    def test_test_button_has_visible_and_keyboard_focus_styles(self):
        self.assertIn('.btn.test-apunte{', HTML)
        self.assertIn('.btn.test-apunte:hover,.btn.test-apunte:focus-visible{', HTML)


if __name__ == "__main__":
    unittest.main()
