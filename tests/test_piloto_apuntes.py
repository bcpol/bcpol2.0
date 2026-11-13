"""Pruebas sin red de la biblioteca BCPOL en una rama de vista previa."""
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
WEB = (ROOT / "apuntes.html").read_text(encoding="utf-8")
PATTERN = re.compile(r"(trafico|administrativa|seguridad):new Set\((\[[^\n]+\])\)")


class Preview(unittest.TestCase):
    def test_lista_blanca_tres_apuntes_piloto(self):
        result = {m: json.loads(values) for m, values in PATTERN.findall(WEB)}
        self.assertEqual({"trafico", "administrativa", "seguridad"}, set(result))
        self.assertEqual({"trafico": 1, "administrativa": 1, "seguridad": 1},
                         {m: len(ids) for m, ids in result.items()})
        self.assertNotIn("111", result["seguridad"])
        self.assertEqual(sum(map(len, result.values())), 3)
        self.assertEqual({"trafico":["9"],"administrativa":["9"],"seguridad":["95"]},result)

    def test_boton_solo_admin_y_tras_sesion_validada(self):
        self.assertIn('if(!token){error("Para ver los apuntes necesitas iniciar sesión.");return;}', WEB)
        self.assertIn('adminTestPorApunte=await comprobarPilotoAdmin();', WEB)
        self.assertIn('data?.ok===true&&data?.username==="bcpol"', WEB)
        self.assertIn('if(adminTestPorApunte&&TEST_DISPONIBLES[materia]?.has(String(item.tema_id)))', WEB)
        self.assertIn('const test=elem("a","btn test-apunte","🧠 Hacer test");', WEB)

    def test_enlace_del_banco_nuevo_no_del_viejo(self):
        self.assertIn('const TEST_BOT_URL="https://t.me/BCPOLTEST_bot?start=";', WEB)
        self.assertIn('const payload="nota_"+materia+"_"+String(item.tema_id).replace(".","_");', WEB)
        self.assertIn('test.href=TEST_BOT_URL+encodeURIComponent(payload);', WEB)
        self.assertIn('test.target="_blank";test.rel="noopener noreferrer";', WEB)
        self.assertNotIn('test.href=TEST_BOT_URL+token', WEB)

    def test_biblioteca_actual_sigue_operativa(self):
        self.assertIn('toggleMark(item,mark)', WEB)
        self.assertIn('safeDrive(item.audio_url)', WEB)
        self.assertIn('api("mark"', WEB)
        self.assertIn('api("list")', WEB)
        self.assertIn('.btn.test-apunte:hover,.btn.test-apunte:focus-visible{', WEB)


if __name__ == "__main__":
    unittest.main()
