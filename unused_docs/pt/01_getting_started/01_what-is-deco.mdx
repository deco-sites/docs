# 📘 Mini Guia – Dicas úteis para trabalhar com o CMS Deco

---
## Tecnologias utilizados por sites deco

1. Preact
2. HTMX
3. Deco Framework
4. Tailwind CSS
5. deno
6. Todas as páginas da deco são renderizadas no servidor com a tecnica (Server Side Rendering).

## About deco framework and CMS

- O framework deco é baseado na entidade de blocos. Blocos são funções typescript que possuem um comportamento comum e uma semântica particular. Os blocos são escritos em pastas com seu nome.
- There some blocks like:
    - sections: which renders HTML with preact and can have inline loaders/actions;
    - loaders: which is a data loader and can connect to outside APIs;
    - actions: are like loaders but accessed via POST
    - pages: are like sections but has path and sections[] props
- Exemplo, um bloco do tipo "sections" fica dentro da pasta `/sections` do projeto.
- O bloco é um arquivo typescript que possue um export default de uma função e possui interface do seu tipo de entrada e de saida.

### Como escrever um bloco

Escrevendo um bloco do tipo section:

```tsx
// arquivo /sections/HelloWorld.tsx
interface HelloWorldProps {
    name: string; // Permite ser configurado no CMS da deco a propriedade name
}

export default function HelloWorld(props: Props) {
    return <div>Olá, mundo! Me chamo {props.name}</div>
}
```

### Como utilizar o bloco

Para utilizar o bloco basta escrever um arquivo JSON com identificador único na pasta /.deco/blocks/<id-do-bloco>.json.
O conteudo do JSON deve conter a propriedade `__resolveType` que identifica unicamente o arquivo.

```json
// /.deco/blocks/hello.json
{
  "__resolveType": "site/sections/HelloWorld.tsx",
  "name": "Meu Nome de Exemplo"
}
```

### Como compor blocos

- Blocos podem ser compostos por outros blocos. O que permite um bloco ser composto por outro são os tipos typescript de entrada e de saida. Exemplo

```tsx
// /loaders/GetAnySection.ts
import type {Section} from "@deco/deco"
interface Props {
  loadingSection: Section
}

export function GetAnySection({ loadingSection }: Props): Promise<string> {
    const section = <loadingSection.Section {...loadingSection.Props} />
    return renderToHTML(section);
}
```

Para referenciar este bloco hello salvo, pode ser feito através do <id-do-bloco>. Exemplo:
```json
{ // qualquer outro block que aceite uma Section.
  "loadingSection": { "__resolveType": "hello" } // hello, nome do arquivo, é o ID do bloco.
}
```


- A interface de cada bloco é compilada e convertida em um formulário no deco CMS para ser editado pelo usuário empresarial que altera o conteúdo do site.


## O bloco de página

O bloco de página contem o uma lista de Sections, que são componentes preact.

```tsx
import type {Section} from "@deco/deco";
interface Props {
    path: string; // Caminho da página
    sections: Section[]
}

export default function Page() {/* ..Page code here */}
```

## Como é a extrura de HTML de uma página deco?

```html
<html
 <head>
  <!-- scripts and links necessários para página funcionar -->
 </head>
 <body>
   <section data-manifest-key="/camino/do/componente.tsx">{Resultado da renderização de componente preact}</section>
   <section data-manifest-key="/camino/do/componente.tsx">{Resultado da renderização de componente preact}</section>
   ... várias sections
   <section data-manifest-key="/camino/do/componente.tsx">{Resultado da renderização de componente preact}</section>
 </body>
</html>
```

## 🧠 Identificar qual componente renderizou cada section

Cada tag `<section>` no HTML gerado pelo Deco inclui um atributo `data-manifest-key`:

```html
<section data-manifest-key="caminho/do/componente.tsx">
```

Esse valor indica o **caminho do arquivo no sistema de arquivos** que originou aquela section.
