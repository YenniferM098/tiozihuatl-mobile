package com.tiozihuatl.app;
import org.junit.Test;
import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
public class MaterialFileInfoTest {
    private final String url = "https://res.cloudinary.com/demo/raw/upload/v1/materiales/ppt/Presentacion";
    private byte[] bytes(int... values) { byte[] result = new byte[values.length]; for (int i = 0; i < values.length; i++) result[i] = (byte) values[i]; return result; }
    @Test public void blocksUnsafeHostsCredentialsAndProtocols() {
        assertTrue(MaterialFileInfo.safeUrl(url));
        for (String value : new String[]{"http://res.cloudinary.com/demo/raw/upload/x", "https://res.cloudinary.com.evil/demo/raw/upload/x", "https://user:pass@res.cloudinary.com/demo/raw/upload/x", "https://res.cloudinary.com:444/demo/raw/upload/x", "https://res.cloudinary.com/login"}) assertFalse(MaterialFileInfo.safeUrl(value));
    }
    @Test public void rejectsAuthenticationPagesJsonAndEmptyResponses() {
        for (String value : new String[]{"<html>login</html>", "{\"error\":\"forbidden\"}", "", "not a PDF"}) {
            assertThrows(Exception.class, () -> MaterialFileInfo.inspect(value.getBytes(StandardCharsets.UTF_8), "application/octet-stream", "PDF", url, "Archivo", null));
        }
    }
    @Test public void rejectsErrorContentTypesWithoutRejectingOpenXmlOffice() {
        for (String mime : new String[]{"text/html", "application/json", "application/xml", "text/xml", "application/problem+xml"})
            assertThrows(Exception.class, () -> MaterialFileInfo.inspect("%PDF-1.7".getBytes(StandardCharsets.UTF_8), mime, "PDF", url, "Archivo", null));
    }
    @Test public void preservesActualImageExtensionAndName() throws Exception {
        MaterialFileInfo png = MaterialFileInfo.inspect(bytes(137,80,78,71,13,10,26,10), "application/octet-stream", "IMAGEN", url + ".png", "Imagen", null);
        assertEquals("image/png", png.mime); assertEquals("Presentacion.png", png.name);
        MaterialFileInfo jpeg = MaterialFileInfo.inspect(bytes(255,216,255), "image/jpeg", "IMAGEN", url + ".jpeg", "Imagen", null);
        assertEquals("Presentacion.jpeg", jpeg.name);
    }
    @Test public void distinguishesOfficeLegacyAndOpenXmlAndMissingExtensions() throws Exception {
        for (String kind : new String[]{"WORD", "EXCEL", "PPT"}) {
            MaterialFileInfo modern = MaterialFileInfo.inspect(bytes(80,75,3,4), "application/octet-stream", kind, url, "Archivo", null);
            assertTrue(modern.mime.contains("openxmlformats"));
            assertEquals(modern.name, MaterialFileInfo.inspect(bytes(80,75,3,4), modern.mime + "; charset=binary", kind, url, "Archivo", null).name);
            assertEquals("Presentacion." + (kind.equals("WORD") ? "docx" : kind.equals("EXCEL") ? "xlsx" : "pptx"), modern.name);
            MaterialFileInfo legacy = MaterialFileInfo.inspect(bytes(208,207,17,224,161,177,26,225), "application/octet-stream", kind, url, "Archivo", null);
            assertEquals("Presentacion." + (kind.equals("WORD") ? "doc" : kind.equals("EXCEL") ? "xls" : "ppt"), legacy.name);
        }
    }
    @Test public void identifiesWebpVideoAndArchives() throws Exception {
        Object[][] formats = {
            {"IMAGEN", bytes(82,73,70,70,0,0,0,0,87,69,66,80), "webp"},
            {"VIDEO", bytes(0,0,0,24,102,116,121,112,109,112,52,50), "mp4"},
            {"VIDEO", bytes(0,0,0,24,102,116,121,112,113,116,32,32), "mov"},
            {"VIDEO", bytes(26,69,223,163), "webm"},
            {"ZIP", bytes(80,75,3,4), "zip"}, {"ZIP", bytes(82,97,114,33), "rar"}, {"ZIP", bytes(55,122,188,175,39,28), "7z"}
        };
        for (Object[] row : formats) assertEquals("Presentacion." + row[2], MaterialFileInfo.inspect((byte[])row[1], "application/octet-stream", (String)row[0], url, "Archivo", null).name);
    }
    @Test public void rejectsWrongTypeEvenWithClaimedPdfMime() {
        assertThrows(Exception.class, () -> MaterialFileInfo.inspect(bytes(255,216,255), "application/pdf", "PDF", url, "PDF", null));
    }
    @Test public void usesDispositionNameWithoutDirectoryTraversal() throws Exception {
        MaterialFileInfo file = MaterialFileInfo.inspect("%PDF-1.7".getBytes(StandardCharsets.UTF_8), "application/pdf", "PDF", url, "Archivo", "attachment; filename*=UTF-8''Cuadro%20acad%C3%A9mico.pdf");
        assertEquals("Cuadro académico.pdf", file.name);
        MaterialFileInfo traversal = MaterialFileInfo.inspect("%PDF-1.7".getBytes(StandardCharsets.UTF_8), "application/pdf", "PDF", url, "Archivo", "attachment; filename=\"../Documento.pdf\"");
        assertEquals(".._Documento.pdf", traversal.name);
    }
    @Test public void replacesOpaqueNamesWithTitleAndAvoidsDuplicateExtensions() throws Exception {
        for (String name : new String[]{"123456", "550e8400-e29b-41d4-a716-446655440000", "d41d8cd98f00b204e9800998ecf8427e", "a9g3j2s8l5m1r6t0v7w4", "archivo_12", "documento"}) {
            MaterialFileInfo info = MaterialFileInfo.inspect("%PDF-1.7".getBytes(StandardCharsets.UTF_8), "application/pdf", "PDF", url + "/" + name + ".pdf", "Guía de Anatomía.pdf", null);
            assertEquals("Guía de Anatomía.pdf", info.name);
        }
        MaterialFileInfo descriptive = MaterialFileInfo.inspect("%PDF-1.7".getBytes(StandardCharsets.UTF_8), "application/pdf", "PDF", url + "/Guia_Anatomia.pdf.pdf", "Otro título", null);
        assertEquals("Guia_Anatomia.pdf", descriptive.name);
        MaterialFileInfo sanitized = MaterialFileInfo.inspect(bytes(137,80,78,71,13,10,26,10), "image/png", "IMAGEN", url + "/123.png", "Clase: órganos / sistemas.png", null);
        assertEquals("Clase_ órganos _ sistemas.png", sanitized.name);
    }

}
