const { get } = require("http")

function mostrando(){
    document.getElementById("card-bodyss2").style.display = "block" 
    document.getElementById("cajaswap").style.display = "none"
}

function ocultando(){
    document.getElementById("card-bodyss2").style.display = "none" 
    document.getElementById("cajaswap").style.display = "block"
}
 
function addStokens(){
    document.getElementById("addtoken").style.display = "block" 
    document.getElementById("cajaswap").style.display = "none"
}
  function OcultandoADStokens(){
      document.getElementById("addtoken").style.display = "none"
      document.getElementById("cajaswap").style.display = "block"
      

  }
  function Conectwallet(){
    document.getElementById("conectwallet").style.display = "block"
    document.getElementById("cajaswap").style.display =    "none"
  }

  function OCultandoconectwallet(){
    document.getElementById("conectwallet").style.display = "none"
    document.getElementById("cajaswap").style.display =    "block"
  }