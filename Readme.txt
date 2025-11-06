To run:

npm install

npm start

node server.js //ON CD SRC

ctrl+c to stop




instale markitdown y pandoc
ollama3.1

ahora responde de esta forma que mas necesitamos hacer para que la entrega este lista para el jueves. Tengo disponible mañana y la próxima semana para terminarlo este fin no puedo apoyar.

npm install child_process fs

setx PATH "$env:PATH;C:\Program Files\Pandoc"

Invoke-WebRequest -Uri http://localhost:4000/convert -Method POST -ContentType "application/json" -Body '{"markdown": "## Test Slide\n- Hola mundo desde Pandoc"}' -OutFile test.pptx


dps terminales:

Invoke-WebRequest -Uri http://localhost:4000/convert -Method POST -ContentType "application/json" -Body '{"markdown": "## Test Slide\n- Hola mundo desde Pandoc"}' -OutFile test.pptx


C:\Users\<your-username>\AppData\Local\Programs\Ollama



pandoc "C:\CETYS\Seventh semester\fermin\Integrador\Slidecraft\src\temp.md" `
  -o "C:\CETYS\Seventh semester\fermin\Integrador\Slidecraft\uploads\out.pptx" `
  --from markdown `
  --to pptx `
  --reference-doc="C:\CETYS\Seventh semester\fermin\Integrador\Slidecraft\templates\template.pptx"
