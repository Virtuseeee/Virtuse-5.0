"""Minimal XLSX writer (no deps): write_xlsx(path, {sheetname: [[row],...]})"""
import zipfile, html
def _col(n):
    s=""
    while n: n,r=divmod(n-1,26); s=chr(65+r)+s
    return s
def _cell(ref,v):
    if v is None or v=="": return ""
    if isinstance(v,bool): return f'<c r="{ref}" t="b"><v>{int(v)}</v></c>'
    if isinstance(v,(int,float)): return f'<c r="{ref}"><v>{v}</v></c>'
    s=html.escape(str(v),quote=False).replace('\x00','')
    return f'<c r="{ref}" t="inlineStr"><is><t xml:space="preserve">{s}</t></is></c>'
def write_xlsx(path,sheets):
    names=list(sheets)
    z=zipfile.ZipFile(path,"w",zipfile.ZIP_DEFLATED)
    z.writestr("[Content_Types].xml",'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+"".join(f'<Override PartName="/xl/worksheets/sheet{i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' for i in range(len(names)))+'</Types>')
    z.writestr("_rels/.rels",'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
    z.writestr("xl/workbook.xml",'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+"".join(f'<sheet name="{html.escape(n,quote=True)}" sheetId="{i+1}" r:id="rId{i+1}"/>' for i,n in enumerate(names))+'</sheets></workbook>')
    z.writestr("xl/_rels/workbook.xml.rels",'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+"".join(f'<Relationship Id="rId{i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i+1}.xml"/>' for i in range(len(names)))+'</Relationships>')
    for i,n in enumerate(names):
        rows=sheets[n]
        body="".join(f'<row r="{ri+1}">'+"".join(_cell(f"{_col(ci+1)}{ri+1}",v) for ci,v in enumerate(row))+'</row>' for ri,row in enumerate(rows))
        z.writestr(f"xl/worksheets/sheet{i+1}.xml",'<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>'+body+'</sheetData></worksheet>')
    z.close()
if __name__=="__main__":
    write_xlsx("out/test.xlsx",{"T":[["a","b"],[1,"čľš"]]}); print("ok")
