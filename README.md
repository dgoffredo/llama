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

### Using node.js
TODO

More
----
### Grammar
TODO

### The `let` Macro
TODO

### Built-in Procedures and Macros
- `(conc args ...)`: Concatenate the arguments, which must all be strings or
  all be symbols, and return the resulting combined string or symbol.
- `(repeat count datum)`: Splice `count` copies of `datum` into the enclosing
  list.
- `(comment args ...)`: Ignore the form -- `comment` is a macro that expands to
  nothing.