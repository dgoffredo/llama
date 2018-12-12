; Special forms:
;
;    let    - Introduce a binding scope to splice into the output.
;
;        (let ([foo "This is the value of foo"]
;              [(Shorthand arg others ...)
;               (Label ((text arg) others ...)
;                 (_.content foo))])
;          (Shorthand "here's one")
;          (Shorthand "here's another" (tooltip "special one")))
;           
;    repeat - Splice a form into the output a certain number of times.
;
;        (repeat 10 (Cell.Column ((name "will be 10 of these in the output"))))
;
;    conc   - Concatenate strings or symbols depending on context. (dubious?)
;
;        (let ([(DataCell name)
;               (Table.Cell ((factory label) (on.text (conc name Display))
;                                            (on.tooltip (conc name Tooltip))
;                                            (on.sortKey name)))])
;          (DataCell created)
;          (DataCell closed)
;          (DataCell group)
;          (DataCell status))
;
; TODO: The whole "if it's not bound to anything, assume string if there's no
;       other interpretation" might be a very bad idea...
;       Or, maybe convenient and no harm done.

(Thing ((click {Event onClick}) (contextMenu {Ref onContextMenu}))
  (let ([tooltip "Here's a long string that I want to have a whole line for."]
        [(Column name ('flex amount) more ...)
         (Table.Column ((bml:name name) (flex amount)
                        ('tooltip tooltip) more ...))])
        ; TODO: Consider even allowing multiple overloads of a pattern.
    (Column "DRQS Number" (flex 0.4))
    (Column "Summary"     (flex 3.0))
    (Column "Group"       (flex 0.3))
    (Column "Status"      (flex 0.2) (something "else"))))

(comment
<Border p:Name="cell_0_0_0" Hold="cell_Hold" Background="{StaticResource y0Brush}" HorizontalAlignment="Left" 
        Height="{StaticResource cellHeight}" Width="{StaticResource cellWidth}"  
        VerticalAlignment="Top" Tap="cell_Tap" Margin="49,402,0,0">
  <Border.Projection>
    <PlaneProjection p:Name="cell_0_0_0_proj" GlobalOffsetZ="0" GlobalOffsetY="0" GlobalOffsetX="0" />
  </Border.Projection>
  <Border.RenderTransform>
    <TranslateTransform p:Name="cell_0_0_0_tran" X="0" Y="0" />
  </Border.RenderTransform>
  <Border.Resources>
    <System:Int32 x:Key="HomeX">0</System:Int32>
    <System:Int32 x:Key="HomeY">0</System:Int32>
    <System:Int32 x:Key="HomeZ">0</System:Int32>
    <System:Boolean x:Key="isPreset">False</System:Boolean>
  </Border.Resources>

  <TextBlock HorizontalAlignment="Center" FontSize="{StaticResource cellFontSize}" FontWeight="{StaticResource cellFontWeight}" Text="" Foreground="Lime" />
</Border>
)
(Border ((p:Name cell_0_0_0) (Hold cell_Hold) (Background {StaticResource y0Brush}) (HorizontalAlignment Left)
         (Height {StaticResource cellHeight}) (Width {StaticResource cellWidth})
         (VerticalAlignment Top) (Tap cell_Tap) (Margin 49,402,0,0))
  (Border.Projection
    (PlaneProjection ((p:Name cell_0_0_0_proj) (GlobalOffsetZ 0) (GlobalOffsetY 0) (GlobalOffsetX 0))))
  (Border.RenderTransform
    (TranslateTransform ((p:Name cell_0_0_0_tran) (X 0) (Y 0))))
  (Border.Resources
    (System:Int32 ((x:Key HomeX)) 0)
    (System:Int32 ((x:Key HomeY)) 0)
    (System:Int32 ((x:Key HomeZ)) 0))

  (TextBlock ((HorizontalAlignment Center) (FontSize {StaticResource cellFontSize}) (FontWeight {StaticResource cellFontWeight}) (Text "") (Foreground Lime))))
