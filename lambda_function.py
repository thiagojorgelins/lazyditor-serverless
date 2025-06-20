import json
import boto3
import base64
import io
import os
from datetime import datetime
import logging
from PIL import Image, ImageEnhance

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3_client = boto3.client('s3')
ORIGINAL_BUCKET = os.environ.get('ORIGINAL_BUCKET', 'lazyditor-original-files')
PROCESSED_BUCKET = os.environ.get('PROCESSED_BUCKET', 'lazyditor-processed-files')

# CORS headers SIMPLES como na versão que funciona
headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
}

def lambda_handler(event, context):
    # Lista para coletar logs de execução
    execution_logs = []
    execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - 🚀 Lazyditor Lambda iniciada")
    
    logger.info("Lazyditor Image Processor Lambda iniciado")
    
    # CORS - igual à versão que funciona
    if event.get('httpMethod') == 'OPTIONS':
        execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - ✅ CORS preflight processado")
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'message': 'CORS OK', 'logs': execution_logs})
        }
    
    try:
        execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - 📥 Parseando dados da requisição...")
        body = json.loads(event.get('body', '{}'))
        operation = body.get('operation')
        file_name = body.get('fileName')
        file_data_b64 = body.get('fileData')
        options = body.get('options', {})

        execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - 📋 Operação: {operation}, Arquivo: {file_name}")

        # Validações essenciais
        if not all([operation, file_name, file_data_b64]):
            error_msg = "Parâmetros obrigatórios ausentes"
            execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - ❌ ERRO: {error_msg}")
            return create_error_response(error_msg, 400, execution_logs)

        logger.info(f"Processando: {file_name}, Operação: {operation}")

        # Decodifica o arquivo da string Base64
        execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - 🔓 Decodificando arquivo Base64...")
        file_data = base64.b64decode(file_data_b64)
        file_size = len(file_data)
        execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - ✅ Arquivo decodificado: {format_bytes(file_size)}")
        
        # Salva o arquivo original no S3
        execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - 💾 Salvando arquivo original...")
        original_s3_info = save_to_s3(file_data, file_name, ORIGINAL_BUCKET, "originals")
        if original_s3_info.get('saved'):
            execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - ✅ Arquivo original salvo")
        else:
            execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - ⚠️ Falha ao salvar original")
        
        # Roteia para a função de processamento correta
        execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - 🔄 Iniciando processamento ({operation})...")
        process_start = datetime.now()
        result = process_image_operation(file_data, operation, options, execution_logs)
        process_time = (datetime.now() - process_start).total_seconds()
        execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - ✅ Processamento concluído em {process_time:.2f}s")
        
        # Salva o arquivo processado no S3
        execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - 💾 Salvando arquivo processado...")
        processed_s3_info = save_to_s3(result.get('buffer'), file_name, PROCESSED_BUCKET, f"processed/{operation}", result.get('extension'))
        if processed_s3_info.get('saved'):
            execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - ✅ Arquivo processado salvo")
        else:
            execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - ⚠️ Falha ao salvar processado")

        execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - 🎉 Execução concluída com sucesso!")
        return create_success_response(result, operation, file_name, original_s3_info, processed_s3_info, execution_logs)
        
    except Exception as e:
        logger.error(f"Erro inesperado: {str(e)}")
        execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - 💥 ERRO: {str(e)}")
        return create_error_response(f"Erro interno: {str(e)}", 500, execution_logs)

def process_image_operation(file_data, operation, options, execution_logs):
    execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - 🔍 Processando operação: {operation}")
    
    if operation == 'resize-image':
        return resize_image(file_data, options, execution_logs)
    elif operation == 'image-to-bw':
        return image_to_blackwhite(file_data, options, execution_logs)
    elif operation == 'create-thumbnail':
        return create_image_thumbnail(file_data, options, execution_logs)
    elif operation == 'enhance-image':
        return enhance_image(file_data, options, execution_logs)
    elif operation == 'image-to-pdf':
        return image_to_pdf(file_data, options, execution_logs)
    else:
        error_msg = f"Operação '{operation}' não suportada"
        execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - ❌ ERRO: {error_msg}")
        raise ValueError(error_msg)

def resize_image(image_data, options, execution_logs):
    width = options.get('width', 800)
    height = options.get('height', 600)
    maintain_ratio = options.get('maintainRatio', True)
    
    execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - 📐 Redimensionando para {width}x{height}")
    
    image = Image.open(io.BytesIO(image_data))
    original_size = image.size
    execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - 📊 Tamanho original: {original_size[0]}x{original_size[1]}")
    
    if maintain_ratio:
        image.thumbnail((width, height), Image.Resampling.LANCZOS)
    else:
        image = image.resize((width, height), Image.Resampling.LANCZOS)
    
    execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - 📊 Novo tamanho: {image.size[0]}x{image.size[1]}")
    
    output = io.BytesIO()
    image = image.convert('RGB')
    image.save(output, format='JPEG', quality=95)
    
    return {
        'buffer': output.getvalue(),
        'extension': 'jpg',
        'content_type': 'image/jpeg',
        'details': f'Redimensionado de {original_size[0]}x{original_size[1]} para {image.size[0]}x{image.size[1]}'
    }

def image_to_blackwhite(image_data, options, execution_logs):
    execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - 🎨 Convertendo para preto e branco")
    
    image = Image.open(io.BytesIO(image_data))
    original_mode = image.mode
    execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - 🎨 Modo original: {original_mode}")
    
    bw_image = image.convert('L')
    execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - 🎨 Convertido para Grayscale")
    
    output = io.BytesIO()
    bw_image.save(output, format='JPEG', quality=90)
    
    return {
        'buffer': output.getvalue(),
        'extension': 'jpg',
        'content_type': 'image/jpeg',
        'details': f'Imagem convertida de {original_mode} para preto e branco'
    }

def create_image_thumbnail(image_data, options, execution_logs):
    size = options.get('size', 256)
    execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - 🖼️ Criando thumbnail {size}x{size}")
    
    image = Image.open(io.BytesIO(image_data))
    original_size = image.size
    execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - 📊 Tamanho original: {original_size[0]}x{original_size[1]}")
    
    image.thumbnail((size, size), Image.Resampling.LANCZOS)
    execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - 📊 Thumbnail: {image.size[0]}x{image.size[1]}")
    
    output = io.BytesIO()
    image = image.convert('RGB')
    image.save(output, format='JPEG', quality=90)
    
    return {
        'buffer': output.getvalue(),
        'extension': 'jpg',
        'content_type': 'image/jpeg',
        'details': f'Thumbnail {image.size[0]}x{image.size[1]} criado'
    }

def enhance_image(image_data, options, execution_logs):
    brightness = options.get('brightness', 1.0)
    contrast = options.get('contrast', 1.0)
    saturation = options.get('saturation', 1.0)
    
    execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - ✨ Aplicando melhorias")
    
    image = Image.open(io.BytesIO(image_data))
    
    if brightness != 1.0:
        image = ImageEnhance.Brightness(image).enhance(brightness)
        execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - ☀️ Brilho: {brightness}")
    if contrast != 1.0:
        image = ImageEnhance.Contrast(image).enhance(contrast)
        execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - 🔆 Contraste: {contrast}")
    if saturation != 1.0 and image.mode in ('RGB', 'RGBA'):
        image = ImageEnhance.Color(image).enhance(saturation)
        execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - 🎨 Saturação: {saturation}")
        
    output = io.BytesIO()
    image = image.convert('RGB')
    image.save(output, format='JPEG', quality=95)
    
    return {
        'buffer': output.getvalue(),
        'extension': 'jpg',
        'content_type': 'image/jpeg',
        'details': f'Melhorias aplicadas'
    }

def image_to_pdf(image_data, options, execution_logs):
    execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - 📄 Convertendo para PDF")
    
    image = Image.open(io.BytesIO(image_data)).convert('RGB')
    original_size = image.size
    execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - 📊 Tamanho: {original_size[0]}x{original_size[1]}")
    
    output = io.BytesIO()
    image.save(output, format='PDF', quality=100)
    
    execution_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] - 📄 PDF gerado")
    
    return {
        'buffer': output.getvalue(),
        'extension': 'pdf',
        'content_type': 'application/pdf',
        'details': f'PDF gerado'
    }

def save_to_s3(data, original_file_name, bucket_name, prefix, extension=None):
    if not bucket_name or not data:
        return {'saved': False, 'error': 'Bucket ou dados não fornecidos'}
    
    try:
        base_name = os.path.splitext(original_file_name)[0]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        if extension:
            s3_key = f"{prefix}/{timestamp}_{base_name}.{extension}"
        else:
            s3_key = f"{prefix}/{timestamp}_{original_file_name}"

        s3_client.put_object(Bucket=bucket_name, Key=s3_key, Body=data)
        download_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket_name, 'Key': s3_key},
            ExpiresIn=3600
        )
        
        logger.info(f"Arquivo salvo: {s3_key}")
        return {'saved': True, 'bucket': bucket_name, 'key': s3_key, 'downloadUrl': download_url}
    
    except Exception as e:
        logger.error(f"Erro S3: {e}")
        return {'saved': False, 'bucket': bucket_name, 'error': str(e)}

def create_error_response(message, status_code=500, logs=None):
    body = {'success': False, 'message': message}
    if logs:
        body['logs'] = logs
    # SEMPRE retornar 200 para evitar problemas de CORS
    return {
        'statusCode': 200,  # Mudança aqui - sempre 200
        'headers': headers,
        'body': json.dumps(body)
    }

def create_success_response(result, operation, file_name, original_s3, processed_s3, logs):
    response_data = {
        'success': True,
        'message': 'Arquivo processado com sucesso!',
        'operation': operation,
        'originalFileName': file_name,
        'processingDetails': result.get('details'),
        'downloadUrl': processed_s3.get('downloadUrl'),
        'logs': logs,
        's3Info': {
            'original': original_s3,
            'processed': processed_s3
        }
    }
    
    return {
        'statusCode': 200,
        'headers': headers,  # Usar os mesmos headers simples
        'body': json.dumps(response_data, default=str)
    }

def format_bytes(bytes_val):
    if bytes_val == 0:
        return "0 B"
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_val < 1024.0:
            return f"{bytes_val:.1f} {unit}"
        bytes_val /= 1024.0
    return f"{bytes_val:.1f} TB"