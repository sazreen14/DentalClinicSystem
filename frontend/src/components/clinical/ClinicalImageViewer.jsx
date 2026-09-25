import {FaArchive,FaTimes} from 'react-icons/fa';
import {displayDate} from './dentalChartUtils';

function dimensions(element){
  const styles=getComputedStyle(element);
  const rect=element.getBoundingClientRect();
  return {clientWidth:element.clientWidth,clientHeight:element.clientHeight,boundingWidth:rect.width,boundingHeight:rect.height,width:styles.width,height:styles.height,maxWidth:styles.maxWidth,maxHeight:styles.maxHeight,overflow:styles.overflow,objectFit:styles.objectFit,position:styles.position,aspectRatio:styles.aspectRatio};
}

function reportDevelopmentDimensions(event){
  if(!import.meta.env.DEV)return;
  const image=event.currentTarget;
  console.debug('[Clinical Image Viewer dimensions]',{naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,image:dimensions(image),imageStage:dimensions(image.parentElement)});
}

export default function ClinicalImageViewer({image,url,readOnly,onClose,onArchive}){
  return <div className="clinical-image-viewer-backdrop" onMouseDown={onClose}>
    <section className="clinical-image-viewer" role="dialog" aria-modal="true" aria-label="Clinical image preview" onMouseDown={event=>event.stopPropagation()}>
      <header><div><small>{image.recordId}{image.appointmentId?` · ${image.appointmentId}`:''}</small><h3>{image.originalFilename}</h3></div><button type="button" onClick={onClose} aria-label="Close"><FaTimes/></button></header>
      <div className="clinical-image-viewer__image-stage">{url?<img className="clinical-image-viewer__full-image" src={url} alt={image.caption||'Clinical dental image'} onLoad={reportDevelopmentDimensions}/>:<p role="status">Loading secure image…</p>}</div>
      <div className="clinical-image-viewer-meta"><p><span>Captured</span><strong>{displayDate(image.createdAt)}</strong></p><p><span>Uploaded by</span><strong>{image.doctor}</strong></p><p><span>Size</span><strong>{Math.ceil(image.byteSize/1024)} KB · {image.mimeType.replace('image/','').toUpperCase()}</strong></p><p><span>Status</span><strong>{image.status}</strong></p></div>
      {image.caption&&<p className="clinical-image-caption">{image.caption}</p>}
      {!readOnly&&image.status==='Active'&&<footer><button type="button" onClick={()=>onArchive(image)}><FaArchive/> Archive image</button></footer>}
    </section>
  </div>;
}
