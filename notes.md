AST Nodes
---------
- string, symbol, number, etc.
- generic form: `(node name kwargs? args*)`
    - is the pythonish call nomenclature misleading? I wanted to avoid "tag."
- the generic form comes about in two ways:
    - `(tag name attributes? children*)`
    - `(let bindings? body*)`
- then a particular binding instance is: `(let-binding pattern template)`

Do tags and "lets" look the same?

    (tag ((name value) (name2 value2)) child child2)

versus

    (let ((pattern template) (pattern2 template2)) body body2)

Hah!

What kinds of lists appear in XML?

    <root name="value" foo="bar>
      Child can be text
      <root.Child />
    </root>

could come from

    (root ((name value) (foo bar))
      "Child can be text"
      (root.Child))

Conversion from Parse Tree to AST
---------------------------------
- string -> string
- number -> number
- quote -> quote (but AST-ify the body anyway. `quote` is for the evaluator.)
- list matches one of:
    - one element: the name
    - more than one element:
        - if the second element is an empty list or a list containing a list,
          then treat it as the attributes list.
        - otherwise, remaining elements are children

Special Forms
-------------
- `let`
- `repeat`
- `conc`
- `ellipsis`?
- `...`?

Do I have to worry about substitution hygiene?

How Does `lambda` work?
-----------------------
```js
const datum = {
    procedure: {
        pattern: {...},
        body: {...}
    }
};
```
```clojure
(let ([foo "hello"])
  (conc foo " there"))

; =>

((lambda (foo)
   (conc foo " there"))
 "hello")

; =>

(conc "hello" " there")

; =>

((lambda (args ...)
   TODO)
 "hello" " there")

; =>

"hello there"
```
Ok, but what about procedure-like bindings?
```clojure
(let ([(Column name flex more ...)
       (Table.Column (('name name) ('flex flex) more ...))])
  (Column "Bob" 0.3))

; =>

(let ([Column (lambda (name flex more ...)
                (Table.Column (('name name) ('flex flex) more ...)))])
  (Column "Bob" 0.3))

; =>

((lambda (Column)
   (Column "Bob" 0.3))
 (lambda (name flex more ...)
   (Table.Column (('name name) ('flex flex) more ...))))

; =>

((lambda (name flex more ...)
   (Table.Column (('name name) ('flex flex) more ...)))
 "Bob" 0.3)

; ... magic ... =>

(Table.Column (('name "Bob") ('flex 0.3)))
```
I can figure out the pattern matching later. For now `lambda` patterns must be
a list of symbols, none of which are `...`.

Environment
-----------
- `let` is a macro that creates an expression involving procedures.
- `repeat` is a procedure that returns a `{splice: ...}` value.
- `conc` is a procedure that takes strings to produce a string or takes symbols
  to produce a symbol.