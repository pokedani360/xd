    --
    -- Ficheiro de esquema para a base de dados
    -- Define a estrutura das tabelas
    --

    -- Assegura que o caminho de pesquisa da base de dados está definido para "$user", public
    SET search_path TO "$user", public;

    -- Tabela de Usuários
    -- Armazena informações de autenticação e perfis (aluno, docente, admin)
    CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        correo VARCHAR(255) UNIQUE NOT NULL,
        contrasena VARCHAR(255) NOT NULL, -- Asumo que isto armazenará uma senha hash
        rol VARCHAR(50) NOT NULL -- 'alumno', 'docente', 'admin'
    );

    -- Tabela de Matérias
    -- Armazena as diferentes matérias escolares (e.g., "Matemáticas", "Linguagem")
    CREATE TABLE IF NOT EXISTS materias (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) UNIQUE NOT NULL
    );

    -- Tabela de Perguntas
    -- Armazena as perguntas que podem ser incluídas nos ensaios
    CREATE TABLE IF NOT EXISTS preguntas (
        id SERIAL PRIMARY KEY,
        enunciado TEXT NOT NULL,
        imagen VARCHAR(255), -- Caminho opcional para uma imagem associada à pergunta
        opcion_a TEXT NOT NULL,
        opcion_b TEXT NOT NULL,
        opcion_c TEXT NOT NULL,
        opcion_d TEXT NOT NULL,
        respuesta_correcta VARCHAR(1) NOT NULL, -- 'A', 'B', 'C' ou 'D'
        materia_id INTEGER NOT NULL REFERENCES materias(id) ON DELETE CASCADE
    );

    -- Tabela de Ensaios
    -- Representa um ensaio criado por um docente
    CREATE TABLE IF NOT EXISTS ensayos (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        docente_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        materia_id INTEGER NOT NULL REFERENCES materias(id) ON DELETE CASCADE
    );

    -- Tabela de Associação Ensaio-Pergunta (Tabela Intermédia para relação Muitos-para-Muitos)
    -- Define quais perguntas pertencem a qual ensaio
    CREATE TABLE IF NOT EXISTS ensayo_pregunta (
        id SERIAL PRIMARY KEY,
        ensayo_id INTEGER NOT NULL REFERENCES ensayos(id) ON DELETE CASCADE,
        pregunta_id INTEGER NOT NULL REFERENCES preguntas(id) ON DELETE CASCADE,
        UNIQUE(ensayo_id, pregunta_id) -- Garante que uma pergunta só pode estar uma vez por ensaio
    );

    -- Tabela de Resultados de Ensaios
    -- Armazena os resultados de cada vez que um aluno realiza um ensaio
    CREATE TABLE IF NOT EXISTS resultados (
        id SERIAL PRIMARY KEY,
        ensayo_id INTEGER NOT NULL REFERENCES ensayos(id) ON DELETE CASCADE,
        alumno_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        puntaje INTEGER DEFAULT 0, -- Pontuação final do ensaio
        fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabela de Respostas
    -- Armazena as respostas individuales dadas pelos alumnos para cada pregunta num ensaio específico
    CREATE TABLE IF NOT EXISTS respuestas (
        id SERIAL PRIMARY KEY,
        resultado_id INTEGER NOT NULL REFERENCES resultados(id) ON DELETE CASCADE,
        pregunta_id INTEGER NOT NULL REFERENCES preguntas(id) ON DELETE CASCADE,
        respuesta_dada VARCHAR(1) NOT NULL, -- A resposta selecionada pelo alumno ('A', 'B', 'C', 'D')
        correcta BOOLEAN NOT NULL, -- Verdadeiro se a resposta foi correta
        -- ¡CORRECCIÓN CLAVE AQUÍ! Adiciona uma restrição UNIQUE para permitir ON CONFLICT
        UNIQUE(resultado_id, pregunta_id)
    );
    