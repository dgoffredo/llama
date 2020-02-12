![llama](llama.jpg)

llama
=====
**L**isp-**L**ike **A**pplication **M**arkup (**A**cronym)

Why
---
XML is `<verbose></verbose>` due to its closing tags and its lack of a macro
preprocessor. I want an XML preprocessor that is very close to XML (declarative,
structured, light on syntax) but that allows me to describe documents in fewer
characters.

What
----
Llama is a lisp-like data description language, and a compiler for that language
targeting XML, implemented in Javascript.

The following Llama:
```clojure
(Table
  (_.columns
    (let ([(Column name flex)
           (Table.Column (('name name) ('flex flex)
                          (dataKey name) (sortable true)))])
      (Column ticketNumber 0.5)
      (Column summary 2.7)
      (Column status 0.2)
      (Column created 0.7)
      (Column closed 0.7))))
```
expands to the following XML:
```xml
<Table>
  <_.columns>
    <Table.Column name="ticketNumber" flex="0.5" dataKey="ticketNumber"
                  sortable="true"/>
    <Table.Column name="summary" flex="2.7" dataKey="summary" sortable="true"/>
    <Table.Column name="status" flex="0.2" dataKey="status" sortable="true"/>
    <Table.Column name="created" flex="0.7" dataKey="created" sortable="true"/>
    <Table.Column name="closed" flex="0.7" dataKey="closed" sortable="true"/>
  </_.columns>
</Table>
```
and the following Llama:
```clojure
(Table.RowTemplate ((name filters))
  (let ([(setter name) ((conc set. name) (conc @ name))]
        [Cell (Table.Cell ((factory label) (on.click {Ref onClick})
                           (setter text) (setter tooltip) (setter style)))])
    (repeat 10 Cell)))
```
expands to the following XML:
```xml
<Table.RowTemplate name="filters">
  <Table.Cell factory="label" on.click="{Ref onClick}" set.text="@text"
              set.tooltip="@tooltip" set.style="@style" />
  <Table.Cell factory="label" on.click="{Ref onClick}" set.text="@text"
              set.tooltip="@tooltip" set.style="@style" />
  <Table.Cell factory="label" on.click="{Ref onClick}" set.text="@text"
              set.tooltip="@tooltip" set.style="@style" />
  <Table.Cell factory="label" on.click="{Ref onClick}" set.text="@text"
              set.tooltip="@tooltip" set.style="@style" />
  <Table.Cell factory="label" on.click="{Ref onClick}" set.text="@text"
              set.tooltip="@tooltip" set.style="@style" />
  <Table.Cell factory="label" on.click="{Ref onClick}" set.text="@text"
              set.tooltip="@tooltip" set.style="@style" />
  <Table.Cell factory="label" on.click="{Ref onClick}" set.text="@text"
              set.tooltip="@tooltip" set.style="@style" />
  <Table.Cell factory="label" on.click="{Ref onClick}" set.text="@text"
              set.tooltip="@tooltip" set.style="@style" />
  <Table.Cell factory="label" on.click="{Ref onClick}" set.text="@text"
              set.tooltip="@tooltip" set.style="@style" />
  <Table.Cell factory="label" on.click="{Ref onClick}" set.text="@text"
              set.tooltip="@tooltip" set.style="@style" />
</Table.RowTemplate>
```

How
---
### Using the Playground
Open [playground/index.html](playground/index.html) in a web browser. The
left panel is an entry accepting Llama. When valid Llama is entered, the
resulting output will appear on the right. Any of the following outputs may
be selected:
- *Tokens*: the tokens lexed from the input string
- *Parse Tree*: the raw data structure parsed from the lexer tokens
- *Evaluated Tree*: the AST after macro expansion and expression evaluation
- *XML Nodes*: a javascript representation of an XML interpretation of the
  evaluated AST.
- *XML Text*: the final XML output

### Using `llama.js`
[bin/llama.js](bin/llama.js) is a [node][node] script that reads llama from a
specified input file or from standard input, and prints the resulting XML to
standard output.

### Using node.js, etc.
Each `.js` file in [llama/](llama/) is an Asynchronous Module Definition
(AMD) module. You can use [requirejs][requirejs], or any other conforming AMD
module loader, to import the llama source modules in node, the browser, or
your javascript environment of choice.

More
----
### Grammar
A Llama value is any of the following productions:

    datum  ::=   STRING
            |    NUMBER
            |    SYMBOL
            |    COMMENT
            |    list
            |    quote

    list   ::=   "(" datum* ")"
            |    "[" datum* "]"
            |    "{" datum* "}"

    quote  ::=  QUOTE datum

    STRING      ::=  /"(?:[^"\\]|\\.)*"/
    WHITESPACE  ::=  /\s+,/
    NUMBER      ::=  /\d[^;'\s()[\]{},]*/
    SYMBOL      ::=  /[^;'\d\s()[\]{},][^;'\s()[\]{},]*/
    QUOTE       ::=  /'/
    COMMENT     ::=  /;[^\n]*(?:\n|$)/

where `WHITESPACE` and `COMMENT` tokens are ignored. Note that the comma is
considered whitespace.

### The `let` Macro
The `let` macro allows for the definition of local name bindings and procedures.
For example, an alias can be given for a long value:
```clojure
(App
  (StaticData
    (let ([matrix (Matrix ((rows 5) (columns 5))
                    (Matrix.rows
                      (let ([row (Matrix.Row 
                                   (Int 0) (Int 0) (Int 0) (Int 0) (Int 0))])
                        row row row row row)))])
      (StaticDatum ((name initialFoo)) matrix)
      (StaticDatum ((name initialBar)) matrix)
      (StaticDatum ((name initialBaz)) matrix)
      (StaticDatum ((name initialZoo)) matrix)
      (StaticDatum ((name initialWho)) matrix)
      (StaticDatum ((name initialYou)) matrix))))
```
That's a lot shorter than the resulting XML:
```xml
<App>
  <StaticData>
    <StaticDatum name="initialFoo">
      <Matrix rows="5" columns="5">
        <Matrix.rows>
          <Matrix.Row>
            <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int>
          </Matrix.Row>
          <Matrix.Row>
            <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int>
          </Matrix.Row>
          <Matrix.Row>
            <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int>
          </Matrix.Row>
          <Matrix.Row>
            <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int>
          </Matrix.Row>
          <Matrix.Row>
            <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int>
          </Matrix.Row>
        </Matrix.rows>
      </Matrix>
    </StaticDatum>
    <StaticDatum name="initialBar">
      <Matrix rows="5" columns="5">
        <Matrix.rows>
          <Matrix.Row>
            <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int>
          </Matrix.Row>
          <Matrix.Row>
            <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int>
          </Matrix.Row>
          <Matrix.Row>
            <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int>
          </Matrix.Row>
          <Matrix.Row>
            <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int>
          </Matrix.Row>
          <Matrix.Row>
            <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int>
          </Matrix.Row>
        </Matrix.rows>
      </Matrix>
    </StaticDatum>
    <StaticDatum name="initialBaz">
      <Matrix rows="5" columns="5">
        <Matrix.rows>
          <Matrix.Row>
            <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int>
          </Matrix.Row>
          <Matrix.Row>
            <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int>
          </Matrix.Row>
          <Matrix.Row>
            <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int>
          </Matrix.Row>
          <Matrix.Row>
            <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int>
          </Matrix.Row>
          <Matrix.Row>
            <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int>
          </Matrix.Row>
        </Matrix.rows>
      </Matrix>
    </StaticDatum>
    <StaticDatum name="initialZoo">
      <Matrix rows="5" columns="5">
        <Matrix.rows>
          <Matrix.Row>
            <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int>
          </Matrix.Row>
          <Matrix.Row>
            <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int>
          </Matrix.Row>
          <Matrix.Row>
            <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int>
          </Matrix.Row>
          <Matrix.Row>
            <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int>
          </Matrix.Row>
          <Matrix.Row>
            <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int>
          </Matrix.Row>
        </Matrix.rows>
      </Matrix>
    </StaticDatum>
    <StaticDatum name="initialWho">
      <Matrix rows="5" columns="5">
        <Matrix.rows>
          <Matrix.Row>
            <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int>
          </Matrix.Row>
          <Matrix.Row>
            <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int>
          </Matrix.Row>
          <Matrix.Row>
            <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int>
          </Matrix.Row>
          <Matrix.Row>
            <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int>
          </Matrix.Row>
          <Matrix.Row>
            <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int>
          </Matrix.Row>
        </Matrix.rows>
      </Matrix>
    </StaticDatum>
    <StaticDatum name="initialYou">
      <Matrix rows="5" columns="5">
        <Matrix.rows>
          <Matrix.Row>
            <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int>
          </Matrix.Row>
          <Matrix.Row>
            <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int>
          </Matrix.Row>
          <Matrix.Row>
            <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int>
          </Matrix.Row>
          <Matrix.Row>
            <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int>
          </Matrix.Row>
          <Matrix.Row>
            <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int> <Int>0</Int>
          </Matrix.Row>
        </Matrix.rows>
      </Matrix>
    </StaticDatum>
  </StaticData>
</App>
```
That Llama can be made even simpler by defining some procedures, another feature
of the `let` macro:
```clojure
(StaticData
    (let ([matrix (Matrix ((rows 5) (columns 5))
                    (Matrix.rows
                      (let ([row (Matrix.Row 
                                   (Int 0) (Int 0) (Int 0) (Int 0) (Int 0))])
                        row row row row row)))]
          [(staticMatrix name) (StaticDatum (('name name)) matrix)])
      (staticMatrix initialFoo)
      (staticMatrix initialBar)
      (staticMatrix initialBaz)
      (staticMatrix initialZoo)
      (staticMatrix initialWho)
      (staticMatrix initialYou))))
```
The real power of `let` procedures, though, is the ability to pattern match
against sequences using the ellipsis. "`...`" stands for "zero or more" of
whatever precedes it. For example:
```clojure
(RowTemplate.cells
  (let ([(Cell expr (attr value) ...)
         (Table.Cell ((factory label) (set.text expr) (attr value) ...))])
    (Cell @name)
    (Cell @email)
    (Cell @rank)
    ; notice the extra attribute(s) in the following:
    (Cell @salary (secret true))
    (Cell @party (secret false) (annotations deprecated))))
```
The `Cell` procedure will take zero or more trailing arguments each matching
`(attr value)`, and append them to the attributes section of the expanded form.

The `...` can even be nested, though it's uncommon:
```clojure
(Example
  (let ([(AllAliases (person alias ...) ...) (Aliases (Alias alias) ... ...)])
    (AllAliases (Robert G-Unit Bob Bert)
                (Steve  Steve-O V-unit)
                (Mary   Steve)
                (Fred   Ed))))
```
expands to:
```xml
<Example>
  <Aliases>
    <Alias>G-Unit</Alias>
    <Alias>Bob</Alias>
    <Alias>Bert</Alias>
    <Alias>Steve-O</Alias>
    <Alias>V-unit</Alias>
    <Alias>Steve</Alias>
    <Alias>Ed</Alias>
  </Aliases>
</Example>
```

### Built-in Procedures and Macros
- `(conc args ...)`: Concatenate the arguments, which can be any mix of strings
  and symbols, and return a string that is their concatenation.
- `(repeat count datum)`: Splice `count` copies of `datum` into the enclosing
  list.
- `(comment args ...)`: Ignore the form. This gives a convenient way to comment
  out blocks of code in a nestable way.

[node]: https://nodejs.org/en/
[requirejs]: https://requirejs.org/
